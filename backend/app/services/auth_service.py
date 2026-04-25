import hashlib
import os
import secrets
import sys

import requests
from app.core.config import Config
from app.core.extensions import cache, db
from app.models.user import User
from app.services.email_service import EmailService
from email_validator import EmailNotValidError, validate_email


class AuthService:
    @staticmethod
    def _validate_registration_email(email_raw):
        email = (email_raw or "").strip()
        if not email:
            return None, "Missing required fields"
        try:
            parsed = validate_email(
                email,
                check_deliverability=True,
            )
            normalized = parsed.normalized
        except EmailNotValidError as e:
            return None, f"Некорректный email: {str(e)}"

        blocked_domains = {
            "example.com",
            "example.org",
            "example.net",
            "test.com",
            "invalid",
            "localhost",
        }
        domain = normalized.split(
            "@", 1)[1].lower() if "@" in normalized else ""
        if domain in blocked_domains:
            return None, "Укажите реальный почтовый адрес"
        return normalized, None

    @staticmethod
    def register_user(data):
        email, email_error = AuthService._validate_registration_email(
            data.get("email"))
        if email_error:
            return (None, email_error)
        username = data.get("username")
        password = data.get("password")
        if not email or not username or (not password):
            return (None, "Missing required fields")
        if User.query.filter_by(email=email).first():
            return (None, "Email already registered")
        if User.query.filter_by(username=username).first():
            return (None, "Username already taken")
        try:
            new_user = User(email=email, username=username, is_verified=0)
            new_user.set_password(password)
            access_token = secrets.token_hex(32)
            refresh_token = secrets.token_hex(32)
            new_user.access_token = access_token
            new_user.refresh_token = refresh_token
            db.session.add(new_user)
            db.session.commit()

            try:
                from app.services.ollama_service import OllamaService

                OllamaService.ensure_chat_with_ai(new_user.id)
            except Exception as e:
                print(f"Failed to create AI chat: {e}")

            token = EmailService.generate_verification_token(email)
            if not EmailService.send_verification_email(email, token):
                return (
                    new_user,
                    "User registered, but failed to send verification email",
                )
            return (new_user, None)
        except Exception as e:
            db.session.rollback()
            return (None, str(e))

    @staticmethod
    def get_user_by_token(access_token):
        user = User.query.filter_by(access_token=access_token).first()
        if not user:
            return None, "Invalid or expired token"
        token_hash = hashlib.sha256(access_token.encode("utf-8")).hexdigest()
        revoked = cache.get(f"revoked_tokens:{user.id}") or []
        if isinstance(revoked, list) and token_hash in revoked:
            return None, "Invalid or expired token"
        if user.is_blocked:
            return None, "User is blocked"
        return user, None

    @staticmethod
    def get_yandex_auth_url():
        client_id = Config.YANDEX_CLIENT_ID
        redirect_uri = Config.YANDEX_REDIRECT_URI
        if not client_id or not redirect_uri:
            return None, "Yandex OAuth not configured"
        return (
            f"https://oauth.yandex.ru/authorize?response_type=code&client_id={client_id}&redirect_uri={redirect_uri}",
            None,
        )

    @staticmethod
    def login_yandex_user(code):
        client_id = Config.YANDEX_CLIENT_ID
        client_secret = Config.YANDEX_CLIENT_SECRET
        redirect_uri = Config.YANDEX_REDIRECT_URI

        if not client_id or not client_secret:
            return None, "Yandex OAuth not configured"

        token_url = "https://oauth.yandex.ru/token"
        data = {
            "grant_type": "authorization_code",
            "code": code,
            "client_id": client_id,
            "client_secret": client_secret,
            "redirect_uri": redirect_uri,
        }

        try:
            response = requests.post(token_url, data=data)
            response.raise_for_status()
            token_data = response.json()
            access_token_yandex = token_data.get("access_token")
        except Exception as e:
            return None, f"Failed to get token: {str(e)}"

        info_url = "https://login.yandex.ru/info"
        headers = {"Authorization": f"OAuth {access_token_yandex}"}

        try:
            info_response = requests.get(info_url, headers=headers)
            info_response.raise_for_status()
            user_info = info_response.json()
        except Exception as e:
            return None, f"Failed to get user info: {str(e)}"

        yandex_id = user_info.get("id")
        email = user_info.get("default_email") or f"{yandex_id}@yandex.oauth"
        username = user_info.get("login") or f"yandex_{yandex_id}"
        avatar_id = user_info.get("default_avatar_id")
        avatar_url = (
            f"https://avatars.yandex.net/get-yapic/{avatar_id}/islands-200"
            if avatar_id and not user_info.get("is_avatar_empty")
            else None
        )

        user = User.query.filter_by(email=email).first()
        if not user:
            if User.query.filter_by(username=username).first():
                username = f"{username}_{secrets.token_hex(4)}"

            user = User(email=email, username=username, is_verified=1)
            user.set_password(secrets.token_hex(16))
            user.access_token = secrets.token_hex(32)
            user.refresh_token = secrets.token_hex(32)
            user.avatar_url = avatar_url
            db.session.add(user)
        else:
            if user.is_blocked:
                return None, "User is blocked"
            user.access_token = secrets.token_hex(32)
            user.refresh_token = secrets.token_hex(32)

        try:
            db.session.commit()

            try:
                from app.services.ollama_service import OllamaService

                OllamaService.ensure_chat_with_ai(user.id)
            except Exception as e:
                print(f"Failed to create AI chat: {e}")

            if (
                user.login_alert_enabled
                and user.email
                and not user.email.endswith("@telegram.bot")
            ):
                EmailService.send_login_alert(user.email)
            return (
                {
                    "user": user,
                    "access_token": user.access_token,
                    "refresh_token": user.refresh_token,
                },
                None,
            )
        except Exception as e:
            db.session.rollback()
            return None, str(e)

    @staticmethod
    def verify_email(token):
        email = EmailService.confirm_token(token)
        if not email:
            return (False, "Invalid or expired token")
        user = User.query.filter_by(email=email).first()
        if not user:
            return (False, "User not found")
        if user.is_verified:
            return (True, "Email already verified")
        user.is_verified = 1
        try:
            db.session.commit()
            return (True, "Email verified successfully")
        except Exception as e:
            db.session.rollback()
            return (False, str(e))

    @staticmethod
    def login_with_user(user):
        if not user:
            return None, "User not found"
        if getattr(user, "is_blocked", False):
            return None, "User is blocked"
        access_token = secrets.token_hex(32)
        refresh_token = secrets.token_hex(32)
        user.access_token = access_token
        user.refresh_token = refresh_token
        try:
            db.session.commit()

            try:
                from app.services.ollama_service import OllamaService

                OllamaService.ensure_chat_with_ai(user.id)
            except Exception as e:
                print(f"Failed to create AI chat: {e}")

            if (
                getattr(user, "login_alert_enabled", False)
                and user.email
                and not user.email.endswith("@telegram.bot")
            ):
                EmailService.send_login_alert(user.email)

            return (
                {
                    "user": user,
                    "access_token": access_token,
                    "refresh_token": refresh_token,
                },
                None,
            )
        except Exception as e:
            db.session.rollback()
            return None, str(e)

    @staticmethod
    def login_user(data):
        email = data.get("email")
        password = data.get("password")
        if not email or not password:
            return (None, "Missing email or password")
        user = User.query.filter_by(email=email).first()
        if not user or not user.check_password(password):
            return (None, "Invalid email or password")
        if user.is_blocked:
            return (None, "User is blocked")
        if not user.is_verified:
            return (None, "Email not verified")
        if user.two_factor_enabled:
            if (user.email or "").endswith("@yandex.ru"):
                pass
            method = user.two_factor_method
            if method == "email":
                email_code = data.get("email_code")
                if not email_code:
                    return (None, "TwoFactorEmailRequired")
                success, err = AuthService.verify_2fa_email_code(
                    user, email_code)
                if not success:
                    return (None, "InvalidTwoFactorCode")
            elif method == "totp":
                totp_code = data.get("totp_code")
                if not totp_code:
                    return (None, "TwoFactorTotpRequired")
                if not AuthService.verify_totp(
                        user.two_factor_secret, totp_code):
                    return (None, "InvalidTwoFactorCode")
        access_token = secrets.token_hex(32)
        refresh_token = secrets.token_hex(32)
        user.access_token = access_token
        user.refresh_token = refresh_token
        try:
            db.session.commit()
            return (
                {
                    "user": user,
                    "access_token": access_token,
                    "refresh_token": refresh_token,
                },
                None,
            )
        except Exception as e:
            db.session.rollback()
            return (None, str(e))

    @staticmethod
    def setup_2fa(current_user, method, enable):
        email = current_user.email or ""
        if enable and email.endswith("@yandex.ru"):
            return None, "для yandex аккаунта это не недоступно"
        if enable:
            current_user.two_factor_enabled = 1
            current_user.two_factor_method = method
            if method == "totp":
                secret = secrets.token_hex(20)
                current_user.two_factor_secret = secret
                current_user.two_factor_email_code = None
                current_user.two_factor_email_code_expires = None
            elif method == "email":
                current_user.two_factor_secret = None
            else:
                return None, "Unsupported 2FA method"
        else:
            current_user.two_factor_enabled = 0
            current_user.two_factor_method = None
            current_user.two_factor_secret = None
            current_user.two_factor_email_code = None
            current_user.two_factor_email_code_expires = None
        try:
            db.session.commit()
            return current_user, None
        except Exception as e:
            db.session.rollback()
            return None, str(e)

    @staticmethod
    def send_2fa_email_code(current_user):
        if not current_user.email:
            return False, "Email not set"
        if current_user.email.endswith("@yandex.ru"):
            return False, "для yandex аккаунта это не недоступно"
        code = "".join(secrets.choice("0123456789") for _ in range(6))
        current_user.two_factor_enabled = 1
        current_user.two_factor_method = "email"
        current_user.two_factor_secret = None
        from datetime import datetime, timedelta

        current_user.two_factor_email_code = code
        current_user.two_factor_email_code_expires = datetime.utcnow() + timedelta(
            minutes=10
        )
        try:
            db.session.commit()
        except Exception as e:
            db.session.rollback()
            return False, str(e)
        if not EmailService.send_2fa_code(current_user.email, code):
            return False, "Failed to send email"
        return True, None

    @staticmethod
    def verify_2fa_email_code(current_user, code):
        from datetime import datetime

        if current_user.two_factor_method != "email":
            return False, "2FA method is not email"
        if (
            not current_user.two_factor_email_code
            or not current_user.two_factor_email_code_expires
        ):
            return False, "No code requested"
        if current_user.two_factor_email_code != str(code):
            return False, "Invalid code"
        if current_user.two_factor_email_code_expires < datetime.utcnow():
            return False, "Code expired"
        current_user.two_factor_email_code = None
        current_user.two_factor_email_code_expires = None
        try:
            db.session.commit()
            return True, None
        except Exception as e:
            db.session.rollback()
            return False, str(e)

    @staticmethod
    def toggle_login_alerts(current_user, enable):
        current_user.login_alert_enabled = 1 if enable else 0
        try:
            db.session.commit()
            return True, None
        except Exception as e:
            db.session.rollback()
            return False, str(e)

    @staticmethod
    def verify_totp(secret_hex, code, window=1):
        try:
            import hashlib
            import hmac
            import struct
            import time

            if not secret_hex:
                return False
            secret = bytes.fromhex(secret_hex)
            timestep = 30
            counter = int(time.time() // timestep)
            code = str(code).strip()
            if not code.isdigit() or len(code) not in (6, 7, 8):
                return False
            for offset in range(-window, window + 1):
                c = counter + offset
                msg = struct.pack(">Q", c)
                hmac_hash = hmac.new(secret, msg, hashlib.sha1).digest()
                o = hmac_hash[19] & 0x0F
                binary = (
                    ((hmac_hash[o] & 0x7F) << 24)
                    | ((hmac_hash[o + 1] & 0xFF) << 16)
                    | ((hmac_hash[o + 2] & 0xFF) << 8)
                    | (hmac_hash[o + 3] & 0xFF)
                )
                otp = binary % 1000000
                if f"{otp:06d}" == code:
                    return True
            return False
        except Exception:
            return False
