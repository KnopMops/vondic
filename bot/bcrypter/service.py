import logging
import secrets
import string

import bcrypt
from werkzeug.security import check_password_hash

from .database import AuthRepository

logger = logging.getLogger(__name__)


class BCrypter:
    def __init__(self, db_path=None):
        self.repo = AuthRepository(db_path)

    @staticmethod
    def _generate_random_key(length: int = 32) -> str:
        alphabet = string.ascii_letters + string.digits
        return "".join((secrets.choice(alphabet) for _ in range(length)))

    @staticmethod
    def _hash_key(key: str) -> str:
        salt = bcrypt.gensalt()
        hashed = bcrypt.hashpw(key.encode("utf-8"), salt)
        return hashed.decode("utf-8")

    @staticmethod
    def _verify_hash(key: str, hashed_key: str) -> bool:
        if not key or not hashed_key:
            return False
        return bcrypt.checkpw(key.encode("utf-8"), hashed_key.encode("utf-8"))

    def register_user(
        self, user_id: str, username: str = None, avatar_url: str = None
    ) -> str:
        if self.repo.user_exists(user_id):
            return None
        key = self._generate_random_key()
        hashed_key = self._hash_key(key)
        username = username or f"user_{user_id}"
        if self.repo.save_user_key(user_id, username, hashed_key, avatar_url):
            return key
        return None

    def rotate_key(self, user_id: str, avatar_url: str = None) -> str:
        if not self.repo.user_exists(user_id):
            return None
        key = self._generate_random_key()
        hashed_key = self._hash_key(key)
        if self.repo.update_user_key(user_id, hashed_key, avatar_url):
            return key
        return None

    def validate_key(self, user_id: str, key: str) -> bool:
        stored_hash = self.repo.get_password_hash(user_id)
        if not stored_hash:
            return False
        return self._verify_hash(key, stored_hash)

    def is_user_registered(self, user_id: str) -> bool:
        return self.repo.user_exists(user_id)

    def authenticate_user(self, email: str, password: str):
        user = self.repo.get_user_by_email(email)
        if not user:
            return None

        if check_password_hash(user["password_hash"], password):
            return user
        return None

    def set_user_premium(self, user_id: str, premium: bool) -> bool:
        return self.repo.set_premium(user_id, 1 if premium else 0)
