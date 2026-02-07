import os
import secrets
import sys

from app.core.config import Config
from app.core.extensions import db
from app.models.user import User
from app.services.email_service import EmailService

bot_path = os.path.join(Config.BASE_DIR, "bot")
if bot_path not in sys.path:
    sys.path.append(bot_path)
try:
    from bcrypter.service import BCrypter
except ImportError:
    BCrypter = None


class AuthService:
    @staticmethod
    def register_user(data):
        email = data.get("email")
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
    def login_telegram_user(data):
        if BCrypter is None:
            return (None, "BCrypter module not available")
        user_id = str(data.get("user_id"))
        secret_key = data.get("secret_key")
        if not user_id or not secret_key:
            return (None, "Missing user_id or secret_key")
        try:
            bcrypter = BCrypter()
            if not bcrypter.validate_key(user_id, secret_key):
                return (None, "Invalid user_id or secret_key")
        except Exception as e:
            return (None, f"Auth verification error: {str(e)}")
        email = f"{user_id}@telegram.bot"
        user = User.query.filter_by(email=email).first()
        if not user:
            username = data.get("username") or f"tg_{user_id}"
            if User.query.filter_by(username=username).first():
                username = f"tg_{user_id}_{secrets.token_hex(4)}"
            user = User(email=email, username=username, is_verified=1)
            user.set_password(secrets.token_hex(16))
            user.access_token = secrets.token_hex(32)
            user.refresh_token = secrets.token_hex(32)
            db.session.add(user)
        else:
            if user.is_blocked:
                return (None, "User is blocked")
            user.access_token = secrets.token_hex(32)
            user.refresh_token = secrets.token_hex(32)
        try:
            db.session.commit()
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
            return (None, str(e))
