import hashlib
import os
import secrets
import sys
from datetime import datetime, timedelta

import requests
from app.core.config import Config
from app.core.extensions import cache, db
from app.models.user import User
from app.services.email_service import EmailService
from email_validator import EmailNotValidError, validate_email
from werkzeug.security import check_password_hash, generate_password_hash


class AuthService:
    @staticmethod
    def _hash_token(token: str | None) -> str | None:
        if not token:
            return None
        return hashlib.sha256(token.encode("utf-8")).hexdigest()

    @staticmethod
    def _issue_tokens(user: User) -> tuple[str, str]:
        """Persist slow password-style hashes; return raw bearer strings once."""
        raw_access = f"{secrets.token_hex(16)}.{secrets.token_urlsafe(40)}"
        raw_refresh = f"{secrets.token_hex(16)}.{secrets.token_urlsafe(40)}"
        user.access_token_lookup = raw_access.split(".", 1)[0]
        user.refresh_token_lookup = raw_refresh.split(".", 1)[0]
        user.access_token = generate_password_hash(raw_access)
        user.refresh_token = generate_password_hash(raw_refresh)
        return raw_access, raw_refresh

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
        from app.utils.email_utils import email_exists

        if email_exists(email):
            return (None, "Email already registered")
        uname = (username or "").strip()
        if User.query.filter(
            db.func.lower(User.username) == uname.lower()
        ).first():
            return (None, "Username already taken")
        try:
            new_user = User(email=email, username=username, is_verified=0)
            new_user.set_password(password)
            raw_access, raw_refresh = AuthService._issue_tokens(new_user)
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
            new_user.access_token = raw_access
            new_user.refresh_token = raw_refresh
            return (new_user, None)
        except Exception as e:
            db.session.rollback()
            return (None, str(e))

    @staticmethod
    def get_user_by_token(access_token):
        token = (access_token or "").strip()
        if not token:
            return None, "Invalid or expired token"
        user = None
        if "." in token:
            lookup, _, _sec = token.partition(".")
            if lookup and _sec and "." not in _sec:
                cand = User.query.filter_by(access_token_lookup=lookup).first()
                if (
                    cand
                    and cand.access_token
                    and check_password_hash(cand.access_token, token)
                ):
                    user = cand
        if not user:
            token_hash = AuthService._hash_token(token)
            if token_hash:
                user = User.query.filter_by(access_token=token_hash).first()
        if not user:
            legacy = User.query.filter_by(access_token=token).first()
            if legacy:
                try:
                    legacy.access_token = generate_password_hash(token)
                    legacy.access_token_lookup = (
                        token.split(".", 1)[0] if "." in token else None
                    )
                    db.session.commit()
                except Exception:
                    db.session.rollback()
                user = legacy
        if not user:

            from app.api.oauth import OAuthAccessToken
            oauth_token = OAuthAccessToken.query.filter_by(token=token).first()
            if oauth_token and not oauth_token.is_expired():
                user = User.query.get(oauth_token.user_id)
        if not user:
            return None, "Invalid or expired token"
        fp = AuthService._hash_token(token)
        revoked = cache.get(f"revoked_tokens:{user.id}") or []
        if isinstance(revoked, list) and fp and fp in revoked:
            return None, "Invalid or expired token"
        if user.is_blocked:
            return None, "User is blocked"
        return user, None

    @staticmethod
    def refresh_with_refresh_token(refresh_token: str | None):
        token = (refresh_token or "").strip()
        if not token:
            return None, "Invalid refresh token"
        user = None
        if "." in token:
            lookup, _, _sec = token.partition(".")
            if lookup and _sec and "." not in _sec:
                cand = User.query.filter_by(
                    refresh_token_lookup=lookup).first()
                if (
                    cand
                    and cand.refresh_token
                    and check_password_hash(cand.refresh_token, token)
                ):
                    user = cand
        if not user:
            th = AuthService._hash_token(token)
            if th:
                user = User.query.filter_by(refresh_token=th).first()
        if not user:
            legacy = User.query.filter_by(refresh_token=token).first()
            if legacy:
                user = legacy
        if not user:
            return None, "Invalid refresh token"
        fp = AuthService._hash_token(token)
        revoked = cache.get(f"revoked_tokens:{user.id}") or []
        if isinstance(revoked, list) and fp and fp in revoked:
            return None, "Invalid refresh token"
        if user.is_blocked:
            return None, "User is blocked"
        raw_access, raw_refresh = AuthService._issue_tokens(user)
        try:
            db.session.commit()
            return (
                {
                    "user": user,
                    "access_token": raw_access,
                    "refresh_token": raw_refresh,
                },
                None,
            )
        except Exception as e:
            db.session.rollback()
            return None, str(e)

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
        from app.utils.email_utils import find_user_by_email, normalize_email

        email = normalize_email(
            user_info.get("default_email") or f"{yandex_id}@yandex.oauth"
        )
        username = user_info.get("login") or f"yandex_{yandex_id}"
        avatar_id = user_info.get("default_avatar_id")
        avatar_url = (
            f"https://avatars.yandex.net/get-yapic/{avatar_id}/islands-200"
            if avatar_id and not user_info.get("is_avatar_empty")
            else None
        )

        user = find_user_by_email(email)
        if not user:
            if User.query.filter(
                db.func.lower(User.username) == username.lower()
            ).first():
                username = f"{username}_{secrets.token_hex(4)}"

            user = User(email=email, username=username, is_verified=1)
            user.set_password(secrets.token_hex(16))
            raw_access, raw_refresh = AuthService._issue_tokens(user)
            user.avatar_url = avatar_url
            db.session.add(user)
        else:
            if user.is_blocked:
                return None, "User is blocked"
            raw_access, raw_refresh = AuthService._issue_tokens(user)

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
                    "access_token": raw_access,
                    "refresh_token": raw_refresh,
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
        from app.utils.email_utils import find_user_by_email

        user = find_user_by_email(email)
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
    def request_password_reset(email):
        from app.utils.email_utils import find_user_by_email, normalize_email

        user = find_user_by_email(normalize_email(email))
        if not user:
            return (False, "User not found")
        raw_token = EmailService.generate_password_reset_token(email)
        user.reset_password_token = AuthService._hash_token(raw_token)
        user.reset_password_expires = datetime.utcnow() + timedelta(hours=1)
        try:
            db.session.commit()
        except Exception as e:
            db.session.rollback()
            return (False, str(e))
        if not EmailService.send_password_reset_email(email, raw_token):
            return (False, "Failed to send email")
        return (True, "Password reset email sent")

    @staticmethod
    def reset_password(token, new_password):
        email = EmailService.confirm_password_reset_token(token)
        if not email:
            return (False, "Invalid or expired token")
        from app.utils.email_utils import find_user_by_email

        user = find_user_by_email(email)
        if not user:
            return (False, "User not found")
        token_hash = AuthService._hash_token(token)
        if (
            not user.reset_password_token
            or user.reset_password_token != token_hash
        ):
            return (False, "Invalid or expired token")
        if user.reset_password_expires and user.reset_password_expires < datetime.utcnow():
            return (False, "Invalid or expired token")
        user.set_password(new_password)
        user.reset_password_token = None
        user.reset_password_expires = None
        try:
            db.session.commit()
            return (True, "Password reset successfully")
        except Exception as e:
            db.session.rollback()
            return (False, str(e))

    @staticmethod
    def logout_user(user, access_token=None, refresh_token=None):
        from app.core.extensions import cache

        revoked_key = f"revoked_tokens:{user.id}"
        revoked = cache.get(revoked_key) or []
        if not isinstance(revoked, list):
            revoked = []

        if access_token:
            access_hash = AuthService._hash_token(access_token)
            if access_hash and access_hash not in revoked:
                revoked.append(access_hash)
        if refresh_token:
            refresh_hash = AuthService._hash_token(refresh_token)
            if refresh_hash and refresh_hash not in revoked:
                revoked.append(refresh_hash)

        if revoked:
            cache.set(revoked_key, revoked[:200], timeout=2592000)

        cache.delete(f"sessions:{user.id}")
        cache.delete(f"sessions_json:{user.id}")

        user.access_token = None
        user.refresh_token = None
        user.access_token_lookup = None
        user.refresh_token_lookup = None
        try:
            db.session.commit()
            return True, None
        except Exception as e:
            db.session.rollback()
            return False, str(e)

    @staticmethod
    def change_password(user, current_password, new_password):
        if not user.check_password(current_password):
            return False, "Invalid current password"
        if len(new_password) < 6:
            return False, "Password must be at least 6 characters"
        user.set_password(new_password)
        try:
            db.session.commit()
            return True, None
        except Exception as e:
            db.session.rollback()
            return False, str(e)

    @staticmethod
    def login_with_user(user):
        if not user:
            return None, "User not found"
        if getattr(user, "is_blocked", False):
            return None, "User is blocked"
        raw_access, raw_refresh = AuthService._issue_tokens(user)
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
                    "access_token": raw_access,
                    "refresh_token": raw_refresh,
                },
                None,
            )
        except Exception as e:
            db.session.rollback()
            return None, str(e)

    @staticmethod
    def login_user(data):
        from app.utils.email_utils import find_user_by_email, normalize_email

        email = normalize_email(data.get("email"))
        password = data.get("password")
        if not email or not password:
            return (None, "Missing email or password")
        user = find_user_by_email(email)
        if not user or not user.check_password(password):
            return (None, "Invalid email or password")
        if user.is_blocked:
            return (None, "User is blocked")
        if not user.is_verified:
            return (None, "Email not verified")
        if user.two_factor_enabled:
            if not (user.email or "").endswith("@yandex.ru"):
                method = (user.two_factor_method or "email").strip().lower()
                if method == "totp" and not user.two_factor_secret:
                    return (None, "TwoFactorTotpNotConfigured")
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
        raw_access, raw_refresh = AuthService._issue_tokens(user)
        try:
            db.session.commit()
            return (
                {
                    "user": user,
                    "access_token": raw_access,
                    "refresh_token": raw_refresh,
                },
                None,
            )
        except Exception as e:
            db.session.rollback()
            return (None, str(e))

    @staticmethod
    def setup_2fa(current_user, method, enable, regenerate_secret=False):
        email = current_user.email or ""
        if enable and email.endswith("@yandex.ru"):
            return None, "для yandex аккаунта это не недоступно"
        if enable:
            method = (method or "email").strip().lower()
            current_user.two_factor_enabled = 1
            current_user.two_factor_method = method
            if method == "totp":
                if regenerate_secret or not current_user.two_factor_secret:
                    current_user.two_factor_secret = secrets.token_hex(20)
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
    def send_2fa_email_code(current_user, for_login=False):
        if not current_user.email:
            return False, "Email not set"
        if current_user.email.endswith("@yandex.ru"):
            return False, "для yandex аккаунта это не недоступно"
        if for_login:
            if (current_user.two_factor_method or "").strip().lower() != "email":
                return False, "2FA method is not email"
        else:
            current_user.two_factor_enabled = 1
            current_user.two_factor_method = "email"
            current_user.two_factor_secret = None
        code = "".join(secrets.choice("0123456789") for _ in range(6))
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
