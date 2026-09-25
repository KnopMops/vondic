import base64
import json
import logging
import os
import secrets
import uuid
from datetime import datetime
from typing import Any, Dict, Optional, Tuple

from app.core.config import Config
from app.core.crypto import hash_password
from app.core.extensions import cache, db
from app.models.passkey import Passkey
from app.models.user import User
from app.services.auth_service import AuthService

logger = logging.getLogger(__name__)


class PasskeyService:
    @staticmethod
    def _b64url_encode(data: bytes) -> str:
        return base64.urlsafe_b64encode(data).decode("ascii").rstrip("=")

    @staticmethod
    def _b64url_decode(data_str: str) -> bytes:
        padding = "=" * ((4 - len(data_str) % 4) % 4)
        return base64.urlsafe_b64decode((data_str + padding).encode("ascii"))

    @staticmethod
    def get_rp_id(host: Optional[str] = None) -> str:
        """Определяет RP ID (Relying Party Identifier) для WebAuthn на основе хоста запроса."""
        if not host:
            return os.environ.get("WEBAUTHN_RP_ID", "vondic.ru")

        clean_host = host.split(":")[0].strip().lower()
        if not clean_host:
            return os.environ.get("WEBAUTHN_RP_ID", "vondic.ru")

        # Для localhost, локальной разработки или внутренних docker-сетей
        if clean_host in ("localhost", "127.0.0.1", "0.0.0.0", "backend", "api", "nginx") or clean_host.endswith(".localhost"):
            return "localhost"

        # Если это IPv4/IPv6 адрес (по спецификации WebAuthn RP ID не может быть IP-адресом)
        import ipaddress
        try:
            ipaddress.ip_address(clean_host)
            return "localhost"
        except ValueError:
            pass

        # Если хост является доменом vondic.ru или поддоменом
        configured_rp = os.environ.get("WEBAUTHN_RP_ID", "vondic.ru").strip().lower()
        if clean_host == configured_rp or clean_host.endswith("." + configured_rp):
            return configured_rp

        return clean_host

    # ==========================================
    # 1. РЕГИСТРАЦИЯ PASSKEY
    # ==========================================

    @staticmethod
    def generate_register_options(
        user: Optional[User] = None,
        email: Optional[str] = None,
        username: Optional[str] = None,
        host: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Генерирует опции WebAuthn для создания нового Passkey."""
        challenge_bytes = secrets.token_bytes(32)
        challenge_b64 = PasskeyService._b64url_encode(challenge_bytes)

        user_id_str = user.id if user else (email or secrets.token_hex(16))
        user_id_bytes = str(user_id_str).encode("utf-8")
        user_id_b64 = PasskeyService._b64url_encode(user_id_bytes)

        user_name = user.email if user else (email or "user@vondic.ru")
        display_name = user.username if user else (username or "Пользователь")

        # Сохраняем challenge в кэш на 5 минут
        cache_key = f"passkey_reg_challenge:{challenge_b64}"
        cache_data = {
            "user_id": user.id if user else None,
            "email": email.strip().lower() if email else (user.email if user else None),
            "username": username.strip() if username else (user.username if user else None),
        }
        cache.set(cache_key, cache_data, timeout=300)

        rp_id = PasskeyService.get_rp_id(host)

        return {
            "challenge": challenge_b64,
            "rp": {
                "name": "Vondic",
                "id": rp_id,
            },
            "user": {
                "id": user_id_b64,
                "name": user_name,
                "displayName": display_name,
            },
            "pubKeyCredParams": [
                {"alg": -7, "type": "public-key"},   # ES256
                {"alg": -257, "type": "public-key"}, # RS256
            ],
            "authenticatorSelection": {
                "residentKey": "preferred",
                "userVerification": "preferred",
            },
            "timeout": 60000,
            "attestation": "none",
        }

    @staticmethod
    def verify_register(
        credential_data: Dict[str, Any],
        password: Optional[str] = None,
        device_name: Optional[str] = None,
        current_user: Optional[User] = None,
    ) -> Tuple[Optional[Dict[str, Any]], Optional[str]]:
        """Верифицирует создание Passkey и регистрирует/привязывает пользователя."""
        try:
            cred_id = credential_data.get("id") or credential_data.get("rawId")
            if not cred_id:
                return None, "Отсутствует credential id"

            response = credential_data.get("response", {})
            client_data_b64 = response.get("clientDataJSON")
            if not client_data_b64:
                return None, "Отсутствует clientDataJSON"

            # Декодируем clientDataJSON
            try:
                client_data_json = json.loads(
                    PasskeyService._b64url_decode(client_data_b64).decode("utf-8")
                )
            except Exception:
                return None, "Некорректный clientDataJSON"

            challenge = str(client_data_json.get("challenge", ""))
            if not challenge:
                return None, "Отсутствует challenge в clientDataJSON"

            # Проверяем кэш с учётом/без padding
            norm_challenge = challenge.rstrip("=")
            saved_ctx = cache.get(f"passkey_reg_challenge:{norm_challenge}")
            if not saved_ctx:
                saved_ctx = cache.get(f"passkey_reg_challenge:{challenge}")
            if not saved_ctx:
                return None, "Срок действия сессии регистрации истёк. Попробуйте снова."
            cache.delete(f"passkey_reg_challenge:{norm_challenge}")
            cache.delete(f"passkey_reg_challenge:{challenge}")

            user_id = saved_ctx.get("user_id")
            email = saved_ctx.get("email")
            username = saved_ctx.get("username")

            user = None
            if current_user:
                user = current_user
            elif user_id:
                user = User.query.get(user_id)
            elif email:
                user = User.query.filter(db.func.lower(User.email) == email.lower()).first()

            if not user:
                # Создание нового пользователя при регистрации
                if not email or not username:
                    return None, "Email и имя пользователя обязательны для создания аккаунта"

                if User.query.filter(db.func.lower(User.email) == email.lower()).first():
                    return None, "Пользователь с таким email уже зарегистрирован"

                final_username = username
                if User.query.filter(db.func.lower(User.username) == username.lower()).first():
                    final_username = f"{username}_{secrets.token_hex(3)}"

                fallback_pw = password if password and len(password) >= 6 else secrets.token_urlsafe(16)
                user = User(
                    email=email,
                    username=final_username,
                    is_verified=1,
                    role="User",
                )
                user.set_password(fallback_pw)
                db.session.add(user)
                db.session.flush()

            # Сохраняем или обновляем Passkey
            existing_passkey = Passkey.query.filter_by(credential_id=cred_id).first()
            if not existing_passkey:
                public_key_raw = response.get("publicKey") or response.get("attestationObject") or ""
                new_passkey = Passkey(
                    user_id=user.id,
                    credential_id=cred_id,
                    public_key=str(public_key_raw),
                    device_name=device_name or "Passkey устройства",
                    transports=credential_data.get("transports") or ["internal"],
                    last_used_at=datetime.utcnow(),
                )
                db.session.add(new_passkey)
            else:
                existing_passkey.user_id = user.id
                existing_passkey.last_used_at = datetime.utcnow()
                if device_name:
                    existing_passkey.device_name = device_name

            db.session.commit()

            # Выдаём JWT токены сессии
            raw_access, raw_refresh = AuthService._issue_tokens(user, device_type="web")
            db.session.commit()

            return {
                "user": user,
                "access_token": raw_access,
                "refresh_token": raw_refresh,
            }, None

        except Exception as e:
            logger.error(f"Passkey register error: {e}")
            db.session.rollback()
            return None, f"Ошибка регистрации Passkey: {str(e)}"

    # ==========================================
    # 2. ВХОД ПО PASSKEY
    # ==========================================

    @staticmethod
    def generate_login_options(host: Optional[str] = None) -> Dict[str, Any]:
        """Генерирует challenge для входа через Passkey."""
        challenge_bytes = secrets.token_bytes(32)
        challenge_b64 = PasskeyService._b64url_encode(challenge_bytes)

        cache_key = f"passkey_login_challenge:{challenge_b64}"
        cache.set(cache_key, True, timeout=300)

        rp_id = PasskeyService.get_rp_id(host)

        return {
            "challenge": challenge_b64,
            "rpId": rp_id,
            "timeout": 60000,
            "userVerification": "preferred",
        }

    @staticmethod
    def verify_login(
        credential_data: Dict[str, Any],
    ) -> Tuple[Optional[Dict[str, Any]], Optional[str]]:
        """Верифицирует подпись Passkey и авторизует пользователя."""
        try:
            cred_id = credential_data.get("id") or credential_data.get("rawId")
            if not cred_id:
                return None, "Отсутствует идентификатор Passkey"

            response = credential_data.get("response", {})
            client_data_b64 = response.get("clientDataJSON")
            if not client_data_b64:
                return None, "Отсутствует clientDataJSON"

            try:
                client_data_json = json.loads(
                    PasskeyService._b64url_decode(client_data_b64).decode("utf-8")
                )
            except Exception:
                return None, "Некорректный clientDataJSON"

            challenge = str(client_data_json.get("challenge", ""))
            if not challenge:
                return None, "Отсутствует challenge"

            norm_challenge = challenge.rstrip("=")
            valid_challenge = cache.get(f"passkey_login_challenge:{norm_challenge}")
            if not valid_challenge:
                valid_challenge = cache.get(f"passkey_login_challenge:{challenge}")
            if not valid_challenge:
                return None, "Срок действия сессии входа истёк. Попробуйте снова."
            cache.delete(f"passkey_login_challenge:{norm_challenge}")
            cache.delete(f"passkey_login_challenge:{challenge}")

            # Находим Passkey в базе данных
            passkey = Passkey.query.filter_by(credential_id=cred_id).first()
            if not passkey:
                return None, "Passkey не зарегистрирован в системе"

            user = User.query.get(passkey.user_id)
            if not user:
                return None, "Пользователь не найден"

            if getattr(user, "is_blocked", False):
                return None, "Аккаунт заблокирован"

            passkey.last_used_at = datetime.utcnow()
            passkey.sign_count = (passkey.sign_count or 0) + 1
            db.session.commit()

            raw_access, raw_refresh = AuthService._issue_tokens(user, device_type="web")
            db.session.commit()

            return {
                "user": user,
                "access_token": raw_access,
                "refresh_token": raw_refresh,
            }, None

        except Exception as e:
            logger.error(f"Passkey login error: {e}")
            db.session.rollback()
            return None, f"Ошибка входа по Passkey: {str(e)}"

    # ==========================================
    # 3. МИГРАЦИЯ PASSKEY НА ДРУГОЕ УСТРОЙСТВО (QR)
    # ==========================================

    @staticmethod
    def create_migration_session(current_user: User, host: Optional[str] = None) -> Dict[str, Any]:
        """Генерирует одноразовый защищённый токен миграции для сканирования QR-кода."""
        migration_token = secrets.token_urlsafe(32)
        cache_key = f"passkey_migration:{migration_token}"

        data = {
            "user_id": current_user.id,
            "email": current_user.email,
            "username": current_user.username,
            "status": "pending",
            "created_at": datetime.utcnow().isoformat(),
        }
        cache.set(cache_key, data, timeout=300)

        # Ссылка для QR-кода
        frontend_url = os.environ.get("FRONTEND_URL")
        if not frontend_url and host:
            proto = "http" if ("localhost" in host or "127.0.0.1" in host) else "https"
            frontend_url = f"{proto}://{host}"
        elif not frontend_url:
            frontend_url = "https://vondic.ru"
        frontend_url = frontend_url.rstrip("/")
        migrate_url = f"{frontend_url}/auth/passkey-migrate?token={migration_token}"

        return {
            "migration_token": migration_token,
            "migrate_url": migrate_url,
            "expires_in": 300,
        }

    @staticmethod
    def get_migration_info(migration_token: str, host: Optional[str] = None) -> Tuple[Optional[Dict[str, Any]], Optional[str]]:
        """Возвращает информацию о миграции и опции создания Passkey для нового устройства."""
        if not migration_token:
            return None, "Токен миграции отсутствует"

        cache_key = f"passkey_migration:{migration_token}"
        data = cache.get(cache_key)
        if not data:
            return None, "QR-код устарел или уже был использован"

        user = User.query.get(data.get("user_id"))
        if not user:
            return None, "Пользователь не найден"

        # Генерируем опции регистрации для второго устройства
        options = PasskeyService.generate_register_options(
            user=user,
            email=user.email,
            username=user.username,
            host=host,
        )

        return {
            "user": {
                "id": user.id,
                "username": user.username,
                "email": user.email,
            },
            "options": options,
            "status": data.get("status", "pending"),
        }

    @staticmethod
    def complete_migration(
        migration_token: str,
        credential_data: Dict[str, Any],
        device_name: Optional[str] = None,
    ) -> Tuple[Optional[Dict[str, Any]], Optional[str]]:
        """Завершает миграцию: регистрирует Passkey на телефоне и мгновенно авторизует его."""
        cache_key = f"passkey_migration:{migration_token}"
        data = cache.get(cache_key)
        if not data:
            return None, "QR-код устарел или уже был использован"

        user_id = data.get("user_id")
        user = User.query.get(user_id)
        if not user:
            return None, "Пользователь не найден"

        # Сохраняем Passkey для нового устройства
        cred_id = credential_data.get("id") or credential_data.get("rawId")
        if not cred_id:
            return None, "Некорректный Passkey с нового устройства"

        response = credential_data.get("response", {})
        public_key_raw = response.get("publicKey") or response.get("attestationObject") or ""

        existing = Passkey.query.filter_by(credential_id=cred_id).first()
        if not existing:
            new_passkey = Passkey(
                user_id=user.id,
                credential_id=cred_id,
                public_key=str(public_key_raw),
                device_name=device_name or "Мобильное устройство (Миграция)",
                transports=credential_data.get("transports") or ["internal"],
                last_used_at=datetime.utcnow(),
            )
            db.session.add(new_passkey)
        else:
            existing.user_id = user.id
            existing.last_used_at = datetime.utcnow()
            if device_name:
                existing.device_name = device_name

        # Помечаем статус миграции как completed
        data["status"] = "completed"
        cache.set(cache_key, data, timeout=60)

        # Авторизуем телефон
        raw_access, raw_refresh = AuthService._issue_tokens(user, device_type="mobile")
        db.session.commit()

        return {
            "user": user,
            "access_token": raw_access,
            "refresh_token": raw_refresh,
        }, None

    @staticmethod
    def exchange_migration_token(
        migration_token: str,
        device_name: Optional[str] = None,
    ) -> Tuple[Optional[Dict[str, Any]], Optional[str]]:
        """Авторизует мобильное устройство напрямую по токену сканирования миграции (QR)."""
        if not migration_token:
            return None, "Токен миграции отсутствует"

        cache_key = f"passkey_migration:{migration_token}"
        data = cache.get(cache_key)
        if not data:
            return None, "QR-код устарел или уже был использован"

        user_id = data.get("user_id")
        user = User.query.get(user_id)
        if not user:
            return None, "Пользователь не найден"

        if getattr(user, "is_blocked", False):
            return None, "Пользователь заблокирован"

        # Помечаем статус миграции как completed
        data["status"] = "completed"
        cache.set(cache_key, data, timeout=60)

        # Выдаем токены мобильному приложению
        raw_access, raw_refresh = AuthService._issue_tokens(
            user, device_type="mobile", device_name=device_name or "Мобильное устройство (QR вход)"
        )
        db.session.commit()

        return {
            "user": user,
            "access_token": raw_access,
            "refresh_token": raw_refresh,
        }, None

    @staticmethod
    def get_migration_status(migration_token: str) -> Dict[str, Any]:
        """Проверяет статус миграции для исходного устройства."""
        cache_key = f"passkey_migration:{migration_token}"
        data = cache.get(cache_key)
        if not data:
            return {"status": "expired"}
        return {"status": data.get("status", "pending")}

    # ==========================================
    # 4. УПРАВЛЕНИЕ СПИСКОМ PASSKEY ПОЛЬЗОВАТЕЛЯ
    # ==========================================

    @staticmethod
    def list_user_passkeys(user_id: str):
        passkeys = Passkey.query.filter_by(user_id=user_id).order_by(Passkey.created_at.desc()).all()
        return [p.to_dict() for p in passkeys]

    @staticmethod
    def delete_user_passkey(user_id: str, passkey_id: str) -> bool:
        passkey = Passkey.query.filter_by(id=passkey_id, user_id=user_id).first()
        if not passkey:
            return False
        db.session.delete(passkey)
        db.session.commit()
        return True
