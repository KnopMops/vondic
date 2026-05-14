import logging

from flask_socketio import ConnectionRefusedError

from webrtc.database import UserRepository

logger = logging.getLogger(__name__)


class ConnectionBroker:
    def __init__(self, repo: UserRepository):
        self.repo = repo

        self._sid_to_user: dict[str, str] = {}

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
        sid_key = str(socket_id)
        self.repo.bind_socket(user_data["id"], sid_key)
        self._sid_to_user[sid_key] = str(user_data["id"])
        role = user_data.get("role", "User")
        logger.info(
            f"Брокер: Пользователь {
                user_data['username']} ({role}) зарегистрирован с сокетом {socket_id}")
        return user_data

    def remember_sid_user(self, socket_id, user_id):
        self._sid_to_user[str(socket_id)] = str(user_id)

    def close_session(self, socket_id):
        sid_key = str(socket_id)
        remembered = self._sid_to_user.pop(sid_key, None)
        released_user_id = self.repo.release_socket(sid_key)
        if released_user_id:
            user_id = released_user_id
        elif remembered:

            forced = self.repo.force_user_offline(remembered)
            user_id = remembered if forced else None
            if forced:
                logger.warning(
                    f"Брокер: Принудительный offline пользователя {
                        remembered}: в БД был неверный socket_id (sid={sid_key})"
                )
        else:
            user_id = None
        logger.info(
            f"Брокер: Сессия сокета {socket_id} закрыта (user_id: {user_id})")
        return user_id

    def resolve_recipient(self, target_socket_id):
        recipient = self.repo.find_user_by_socket(target_socket_id)
        if recipient:
            return recipient
        return None

    def get_user_socket(self, user_id):
        return self.repo.get_socket_by_user_id(user_id)
