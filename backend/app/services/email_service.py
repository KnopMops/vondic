from itsdangerous import URLSafeTimedSerializer
from app.core.config import settings
from app.services.rabbitmq_publisher import publish_to_queue


class EmailService:
    @staticmethod
    def generate_verification_token(email):
        serializer = URLSafeTimedSerializer(settings.SECRET_KEY)
        return serializer.dumps(email, salt="email-confirm-salt")

    @staticmethod
    def confirm_token(token, expiration=3600):
        serializer = URLSafeTimedSerializer(settings.SECRET_KEY)
        try:
            email = serializer.loads(
                token, salt="email-confirm-salt", max_age=expiration
            )
        except Exception:
            return False
        return email

    @staticmethod
    def send_verification_email(to_email, token):
        frontend_url = settings.FRONTEND_URL or "http://localhost:3000"
        verify_url = f"{frontend_url}/verify?token={token}"
        html = (
            f'\n        <p>Добро пожаловать!</p>\n'
            f'        <p>Пожалуйста, подтвердите вашу почту, перейдя по ссылке:</p>\n'
            f'        <p><a href="{verify_url}">{verify_url}</a></p>\n'
            f'        <br>\n'
            f'        <p>Если вы не регистрировались, проигнорируйте это письмо.</p>\n        '
        )

        published = publish_to_queue("email_queue", {
            "type": "verification",
            "to_email": to_email,
            "subject": "Подтверждение регистрации Vondic",
            "html": html,
        })
        return bool(published)

    @staticmethod
    def send_2fa_code(to_email, code):
        html = f"<p>Ваш код подтверждения входа: <b>{code}</b></p><p>Код действует 10 минут.</p>"

        published = publish_to_queue("email_queue", {
            "type": "2fa_code",
            "to_email": to_email,
            "subject": "Код для входа Vondic",
            "html": html,
        })
        return bool(published)

    @staticmethod
    def send_system_notification_email(to_email, username, message_body):
        name = (username or "пользователь").strip()
        body = (message_body or "").strip()
        html = (
            f"<p>Здравствуйте, {name},</p>"
            f"<p>{body}</p>"
            f"<p>Благодарим за внимание.</p>"
        )

        published = publish_to_queue("email_queue", {
            "type": "system_notification",
            "to_email": to_email,
            "subject": "Уведомление Vondic",
            "html": html,
        })
        return bool(published)

    @staticmethod
    def send_login_alert(to_email):
        html = "<p>Зафиксирован вход в ваш аккаунт Vondic.</p><p>Если это были не вы, срочно смените пароль.</p>"

        published = publish_to_queue("email_queue", {
            "type": "login_alert",
            "to_email": to_email,
            "subject": "Оповещение о входе в аккаунт Vondic",
            "html": html,
        })
        return bool(published)

    @staticmethod
    def generate_password_reset_token(email):
        serializer = URLSafeTimedSerializer(settings.SECRET_KEY)
        return serializer.dumps(email, salt="password-reset-salt")

    @staticmethod
    def confirm_password_reset_token(token, expiration=3600):
        serializer = URLSafeTimedSerializer(settings.SECRET_KEY)
        try:
            email = serializer.loads(
                token, salt="password-reset-salt", max_age=expiration
            )
        except Exception:
            return False
        return email

    @staticmethod
    def send_password_reset_email(to_email, token):
        frontend_url = settings.FRONTEND_URL or "http://localhost:3000"
        reset_url = f"{frontend_url}/reset-password?token={token}"
        html = (
            f'<p>Вы запросили сброс пароля для аккаунта Vondic.</p>'
            f'<p>Перейдите по ссылке для смены пароля:</p>'
            f'<p><a href="{reset_url}">{reset_url}</a></p>'
            f'<br>'
            f'<p>Ссылка действительна в течение 1 часа.</p>'
            f'<p>Если вы не запрашивали сброс пароля, проигнорируйте это письмо.</p>'
        )

        published = publish_to_queue("email_queue", {
            "type": "password_reset",
            "to_email": to_email,
            "subject": "Сброс пароля Vondic",
            "html": html,
        })
        return bool(published)
