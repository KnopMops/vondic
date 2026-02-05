import secrets

from app.core.extensions import db
from app.models.user import User
from app.services.email_service import EmailService


class AuthService:
    @staticmethod
    def register_user(data):
        email = data.get("email")
        username = data.get("username")
        password = data.get("password")

        if not email or not username or not password:
            return None, "Missing required fields"

        if User.query.filter_by(email=email).first():
            return None, "Email already registered"

        if User.query.filter_by(username=username).first():
            return None, "Username already taken"

        try:
            new_user = User(
                email=email,
                username=username,
                is_verified=0,  # Явно указываем, что не верифицирован
            )
            new_user.set_password(password)

            db.session.add(new_user)
            db.session.commit()

            # Отправка верификационного письма
            token = EmailService.generate_verification_token(email)
            EmailService.send_verification_email(email, token)

            return new_user, None
        except Exception as e:
            db.session.rollback()
            return None, str(e)

    @staticmethod
    def verify_email(token):
        email = EmailService.confirm_token(token)
        if not email:
            return False, "Invalid or expired token"

        user = User.query.filter_by(email=email).first()
        if not user:
            return False, "User not found"

        if user.is_verified:
            return True, "Email already verified"

        user.is_verified = 1
        try:
            db.session.commit()
            return True, "Email verified successfully"
        except Exception as e:
            db.session.rollback()
            return False, str(e)

    @staticmethod
    def login_user(data):
        email = data.get("email")
        password = data.get("password")

        if not email or not password:
            return None, "Missing email or password"

        user = User.query.filter_by(email=email).first()

        if not user or not user.check_password(password):
            return None, "Invalid email or password"

        if user.is_blocked:
            return None, "User is blocked"

        if not user.is_verified:
            return None, "Email not verified"

        access_token = secrets.token_hex(32)
        refresh_token = secrets.token_hex(32)

        user.access_token = access_token
        user.refresh_token = refresh_token

        try:
            db.session.commit()
            return {
                "user": user,
                "access_token": access_token,
                "refresh_token": refresh_token,
            }, None
        except Exception as e:
            db.session.rollback()
            return None, str(e)
