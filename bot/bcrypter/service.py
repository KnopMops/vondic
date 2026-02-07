import logging
import secrets
import string

import bcrypt

from .database import AuthRepository

logger = logging.getLogger(__name__)


class BCrypter:
    def __init__(self, db_path=None):
        """
        Инициализирует библиотеку BCrypter.
        :param db_path: Путь к базе данных (необязательно).
        """
        self.repo = AuthRepository(db_path)

    @staticmethod
    def _generate_random_key(length: int = 32) -> str:
        """Генерирует безопасный случайный URL-безопасный ключ."""
        alphabet = string.ascii_letters + string.digits
        return "".join((secrets.choice(alphabet) for _ in range(length)))

    @staticmethod
    def _hash_key(key: str) -> str:
        """Хеширует ключ с использованием bcrypt."""
        salt = bcrypt.gensalt()
        hashed = bcrypt.hashpw(key.encode("utf-8"), salt)
        return hashed.decode("utf-8")

    @staticmethod
    def _verify_hash(key: str, hashed_key: str) -> bool:
        """Проверяет ключ на соответствие хешу."""
        if not key or not hashed_key:
            return False
        return bcrypt.checkpw(key.encode("utf-8"), hashed_key.encode("utf-8"))

    def register_user(self, user_id: str, username: str = None) -> str:
        """
        Регистрирует нового пользователя, генерирует и сохраняет ключ.
        Возвращает сгенерированный ключ или None в случае ошибки.
        """
        if self.repo.user_exists(user_id):
            logger.warning(f"Пользователь {user_id} уже существует.")
            return None
        key = self._generate_random_key()
        hashed_key = self._hash_key(key)
        username = username or f"user_{user_id}"
        if self.repo.save_user_key(user_id, username, hashed_key):
            logger.info(f"Пользователь {user_id} успешно зарегистрирован.")
            return key
        return None

    def rotate_key(self, user_id: str) -> str:
        """
        Генерирует новый ключ для существующего пользователя.
        Возвращает новый ключ или None, если пользователь не найден.
        """
        if not self.repo.user_exists(user_id):
            logger.warning(f"Пользователь {user_id} не найден.")
            return None
        key = self._generate_random_key()
        hashed_key = self._hash_key(key)
        if self.repo.update_user_key(user_id, hashed_key):
            logger.info(f"Ключ для пользователя {user_id} обновлен.")
            return key
        return None

    def validate_key(self, user_id: str, key: str) -> bool:
        """
        Проверяет валидность ключа для указанного пользователя.
        """
        stored_hash = self.repo.get_password_hash(user_id)
        if not stored_hash:
            return False
        return self._verify_hash(key, stored_hash)

    def is_user_registered(self, user_id: str) -> bool:
        """Проверяет, зарегистрирован ли пользователь."""
        return self.repo.user_exists(user_id)
