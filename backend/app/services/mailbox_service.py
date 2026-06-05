"""Управление ящиками @vondic.ru и провижининг в docker-mailserver."""

from __future__ import annotations

import os
import re
import shutil
import subprocess

from app.core.extensions import db
from app.utils.docker_exec import container_exec
from app.models.mailbox import Mailbox, MailboxCredential
from app.models.user import User
from app.services.mail_imap_service import MailImapService
from app.utils.mail_crypto import decrypt_mail_password, encrypt_mail_password
from flask import current_app

_LOCAL_PART_RE = re.compile(r"^[a-z0-9][a-z0-9._-]{1,62}[a-z0-9]$", re.I)
_DOMAIN = "vondic.ru"
MAILBOX_SIGNUP_COINS = 200


def _normalize_local_part(value: str) -> str:
    local = value.strip().lower().replace("@vondic.ru", "").replace("@", "")
    if not _LOCAL_PART_RE.match(local):
        raise ValueError(
            "Локальная часть адреса: 3–64 символа, латиница, цифры, . _ -"
        )
    return local


def suggest_local_part(user: User) -> str:
    raw = (user.username or "").strip().lower()
    raw = re.sub(r"[^a-z0-9._-]", "", raw)
    if _LOCAL_PART_RE.match(raw):
        return raw
    fallback = re.sub(
        r"[^a-z0-9]",
        "",
        (user.email or "").split("@")[0].lower())
    if _LOCAL_PART_RE.match(fallback):
        return fallback
    return "user"


class MailboxService:
    suggest_local_part = staticmethod(suggest_local_part)

    @staticmethod
    def get_for_user(user_id: str) -> Mailbox | None:
        return Mailbox.query.filter_by(user_id=user_id, is_active=1).first()

    @staticmethod
    def get_mail_client(user: User) -> MailImapService | None:
        box = MailboxService.get_for_user(user.id)
        if not box or not box.credential:
            return None
        try:
            password = decrypt_mail_password(box.credential.password_encrypted)
        except ValueError:
            return None
        try:
            from app.utils.mail_crypto import encrypt_mail_password

            re_encrypted = encrypt_mail_password(password)
            if re_encrypted != box.credential.password_encrypted:
                box.credential.password_encrypted = re_encrypted
                db.session.commit()
        except Exception:
            db.session.rollback()
        return MailImapService(box.address, password)

    @staticmethod
    def mailbox_to_dict(box: Mailbox, include_address: bool = True) -> dict:
        return {
            "id": box.id,
            "address": box.address if include_address else None,
            "display_name": box.display_name,
            "quota_mb": box.quota_mb,
            "is_active": bool(
                box.is_active),
            "created_at": box.created_at.isoformat() if box.created_at else None,
        }

    @staticmethod
    def create_mailbox(
        user: User,
        local_part: str,
        password: str,
        display_name: str | None = None,
        quota_mb: int = 1024,
    ) -> tuple[Mailbox | None, str | None, int]:
        if MailboxService.get_for_user(user.id):
            return None, "У вас уже есть почтовый ящик", 0

        try:
            local = _normalize_local_part(local_part)
        except ValueError as e:
            return None, str(e), 0

        if len(password) < 10:
            return None, "Пароль ящика: минимум 10 символов", 0

        quota_mb = max(256, min(int(quota_mb), 10240))

        address = f"{local}@{_DOMAIN}"
        if Mailbox.query.filter_by(address=address).first():
            return None, "Этот адрес уже занят", 0

        provision_error = MailboxService._provision_on_mailserver(
            address, password, quota_mb
        )
        if provision_error:
            return None, provision_error, 0

        box = Mailbox(
            user_id=user.id,
            address=address,
            display_name=display_name or user.username,
            quota_mb=quota_mb,
        )
        cred = MailboxCredential(
            mailbox=box,
            password_encrypted=encrypt_mail_password(password),
        )
        db.session.add(box)
        db.session.add(cred)
        user.balance = int(user.balance or 0) + MAILBOX_SIGNUP_COINS
        try:
            db.session.commit()
        except Exception:
            db.session.rollback()
            return None, "Не удалось сохранить ящик в базе", 0

        return box, None, MAILBOX_SIGNUP_COINS

    @staticmethod
    def _provision_on_mailserver(
        address: str, password: str, quota_mb: int
    ) -> str | None:
        if not current_app.config.get("MAIL_PROVISION_ENABLED"):
            return (
                "Создание ящиков отключено (MAIL_PROVISION_ENABLED=0). "
                f"Обратитесь к администратору или: ./mail/scripts/add-mailbox.sh {address} '...' {quota_mb}"
            )

        container = current_app.config.get(
            "MAIL_DOCKER_CONTAINER") or "mailserver"
        cmd = ["setup", "email", "add", address, password, str(quota_mb)]
        socket_path = current_app.config.get(
            "MAIL_DOCKER_SOCKET") or "/var/run/docker.sock"

        exit_code, out = MailboxService._run_in_mailserver(
            container, cmd, socket_path=socket_path
        )
        lower = out.lower()
        if exit_code == 0:
            return None
        if "already exists" in lower or "already registered" in lower:
            return None
        if exit_code == 127 and "no such container" in lower:
            return f"Контейнер {container} не запущен. Поднимите mailserver."
        if exit_code == 127 and "docker socket" in lower:
            return (
                f"{out} Смонтируйте /var/run/docker.sock и задайте DOCKER_GID "
                "(getent group docker | cut -d: -f3)."
            )
        return f"mailserver: {out or f'exit {exit_code}'}"

    @staticmethod
    def _resolve_docker_bin() -> str | None:
        configured = current_app.config.get("MAIL_DOCKER_BIN")
        candidates = [
            configured,
            "/usr/bin/docker",
            "/usr/local/bin/docker",
            "docker"]
        for name in candidates:
            if not name:
                continue
            if name.startswith("/"):
                if os.path.isfile(name) and os.access(name, os.X_OK):
                    return name
            else:
                found = shutil.which(name)
                if found:
                    return found
        return None

    @staticmethod
    def _run_in_mailserver(
        container: str,
        cmd: list[str],
        socket_path: str = "/var/run/docker.sock",
    ) -> tuple[int, str]:
        docker_bin = MailboxService._resolve_docker_bin()
        if docker_bin:
            try:
                proc = subprocess.run(
                    [docker_bin, "exec", container, *cmd],
                    capture_output=True,
                    text=True,
                    timeout=90,
                    check=False,
                )
                out = ((proc.stdout or "") + (proc.stderr or "")).strip()
                return proc.returncode, out
            except subprocess.TimeoutExpired:
                return 124, "Таймаут создания ящика в mailserver"
            except PermissionError:
                pass
            except OSError:
                pass

        code, err = container_exec(container, cmd, socket_path=socket_path)
        return code, err
