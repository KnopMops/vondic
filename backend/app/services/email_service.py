from app.core.extensions import mail
from flask import current_app, url_for
from flask_mail import Message
from itsdangerous import URLSafeTimedSerializer


class EmailService:
    @staticmethod
    def generate_verification_token(email):
        serializer = URLSafeTimedSerializer(current_app.config["SECRET_KEY"])
        return serializer.dumps(email, salt="email-confirm-salt")

    @staticmethod
    def confirm_token(token, expiration=3600):
        serializer = URLSafeTimedSerializer(current_app.config["SECRET_KEY"])
        try:
            email = serializer.loads(
                token, salt="email-confirm-salt", max_age=expiration
            )
        except Exception:
            return False
        return email

    @staticmethod
    def send_verification_email(to_email, token):
        verify_url = url_for("auth.verify_email", token=token, _external=True)
        html = f"""
        <p>Добро пожаловать!</p>
        <p>Пожалуйста, подтвердите вашу почту, перейдя по ссылке:</p>
        <p><a href="{verify_url}">{verify_url}</a></p>
        <br>
        <p>Если вы не регистрировались, проигнорируйте это письмо.</p>
        """

        msg = Message(
            subject="Подтверждение регистрации Vondic", recipients=[to_email], html=html
        )
        try:
            mail.send(msg)
            return True
        except Exception as e:
            # В продакшене лучше логировать ошибку
            print(f"Error sending email: {e}")
            return False
