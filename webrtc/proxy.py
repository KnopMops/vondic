import logging

from flask_socketio import ConnectionRefusedError

from .database import UserRepository

logger = logging.getLogger(__name__)

class ConnectionBroker:
    def __init__(self, repo: UserRepository):
        self.repo = repo

    def register_session(self, token, socket_id):
        user_data = self.repo.fetch_user_by_token(token)
        if not user_data:
            logger.warning(
                f"Брокер: Ошибка аутентификации для токена {token} (Пользователь не найден)")
            raise ConnectionRefusedError(
                "401 Unauthorized: Пользователь не найден")
        if user_data.get("is_blocked"):
            logger.warning(
                f"Брокер: Пользователь {user_data['username']} заблокирован")
            raise ConnectionRefusedError(
                "401 Unauthorized: Пользователь заблокирован")
        self.repo.bind_socket(user_data["id"], socket_id)
        role = user_data.get("role", "User")
        logger.info(
            f"Брокер: Пользователь {
                user_data['username']} ({role}) зарегистрирован с сокетом {socket_id}")
        return user_data

    def close_session(self, socket_id):
        self.repo.release_socket(socket_id)
        logger.info(f"Брокер: Сессия сокета {socket_id} закрыта")

    def resolve_recipient(self, target_socket_id):
        recipient = self.repo.find_user_by_socket(target_socket_id)
        if recipient:
            return recipient
        return None

    def get_user_socket(self, user_id):
        return self.repo.get_socket_by_user_id(user_id)
