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
        frontend_url = current_app.config.get("FRONTEND_URL") or "http://localhost:3000"
        verify_url = f"{frontend_url}/verify?token={token}"
        html = f'\n        <p>Добро пожаловать!</p>\n        <p>Пожалуйста, подтвердите вашу почту, перейдя по ссылке:</p>\n        <p><a href="{verify_url}">{verify_url}</a></p>\n        <br>\n        <p>Если вы не регистрировались, проигнорируйте это письмо.</p>\n        '
        msg = Message(
            subject="Подтверждение регистрации Vondic",
            recipients=[to_email],
            html=html)
        try:
            mail.send(msg)
            return True
        except Exception as e:
            print(f"Error sending email: {e}")
            return False

    @staticmethod
    def send_2fa_code(to_email, code):
        html = f"<p>Ваш код подтверждения входа: <b>{code}</b></p><p>Код действует 10 минут.</p>"
        msg = Message(subject="Код для входа Vondic",
                      recipients=[to_email], html=html)
        try:
            mail.send(msg)
            return True
        except Exception as e:
            print(f"Error sending 2FA email: {e}")
            return False

    @staticmethod
    def send_login_alert(to_email):
        html = "<p>Зафиксирован вход в ваш аккаунт Vondic.</p><p>Если это были не вы, срочно смените пароль.</p>"
        msg = Message(
            subject="Оповещение о входе в аккаунт Vondic",
            recipients=[to_email],
            html=html,
        )
        try:
            mail.send(msg)
            return True
        except Exception as e:
            print(f"Error sending login alert: {e}")
            return False
