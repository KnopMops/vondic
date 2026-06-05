"""Публичный Mail API: права ключа, отправка, noreply."""

from __future__ import annotations

from typing import Any

from app.services.mail_imap_service import MailImapService
from app.services.mailbox_service import MailboxService
from app.models.user import User
from flask import current_app
from werkzeug.security import check_password_hash

DEFAULT_MAIL_API_PERMISSIONS: dict[str, bool] = {
    "send": False,
    "read": False,
    "delete": False,
}

MAIL_API_PERMISSION_KEYS = ("send", "read", "delete")


def normalize_mail_api_permissions(raw: dict | None) -> dict[str, bool]:
    base = dict(DEFAULT_MAIL_API_PERMISSIONS)
    if isinstance(raw, dict):
        for key in MAIL_API_PERMISSION_KEYS:
            if key in raw:
                base[key] = bool(raw[key])
    return base


def get_mail_api_permissions(user: User) -> dict[str, bool]:
    return normalize_mail_api_permissions(user.mail_api_permissions)


def set_mail_api_permissions(user: User, data: dict) -> dict[str, bool]:
    current = get_mail_api_permissions(user)
    for key in MAIL_API_PERMISSION_KEYS:
        if key in data:
            current[key] = bool(data[key])
    user.mail_api_permissions = current
    return current


def user_has_mail_permission(user: User, permission: str) -> bool:
    if permission not in MAIL_API_PERMISSION_KEYS:
        return False
    return get_mail_api_permissions(user).get(permission, False)


def get_mail_client_for_user(user: User) -> MailImapService | None:
    return MailboxService.get_mail_client(user)


def parse_recipients(raw: Any) -> list[str]:
    if not raw:
        return []
    if isinstance(raw, str):
        return [a.strip() for a in raw.split(",") if a.strip()]
    return [str(a).strip() for a in raw if str(a).strip()]


def send_via_user_mailbox(
    user: User,
    *,
    to_addrs: list[str],
    subject: str,
    body_text: str,
    body_html: str | None = None,
    cc: list[str] | None = None,
) -> None:
    client = get_mail_client_for_user(user)
    if not client:
        raise ValueError("Почтовый ящик не подключён")
    client.send_message(
        to_addrs=to_addrs,
        subject=subject,
        body_text=body_text,
        body_html=body_html,
        cc=cc,
    )


def _noreply_smtp_password() -> str | None:
    return (
        current_app.config.get("MAIL_NOREPLY_SMTP_PASSWORD")
        or current_app.config.get("MAIL_PASSWORD")
    )


def _noreply_api_password() -> str | None:
    return (
        current_app.config.get("MAIL_NOREPLY_API_PASSWORD")
        or _noreply_smtp_password()
    )


def verify_noreply_api_password(password: str) -> bool:
    expected = _noreply_api_password()
    if not expected:
        return False
    stored_hash = current_app.config.get("MAIL_NOREPLY_API_PASSWORD_HASH")
    if stored_hash:
        return check_password_hash(stored_hash, password)
    return password == expected


def send_noreply_message(
    *,
    to_addrs: list[str],
    subject: str,
    body_text: str,
    body_html: str | None = None,
) -> None:
    address = (
        current_app.config.get("MAIL_NOREPLY_ADDRESS") or "noreply@vondic.ru"
    ).strip()
    password = _noreply_smtp_password()
    if not password:
        raise RuntimeError("MAIL_NOREPLY_SMTP_PASSWORD не настроен")
    client = MailImapService(address, password)
    client.send_message(
        to_addrs=to_addrs,
        subject=subject,
        body_text=body_text or "(пусто)",
        body_html=body_html,
    )
