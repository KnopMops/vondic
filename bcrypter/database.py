import sqlite3
import logging
import os
from datetime import datetime

logger = logging.getLogger(__name__)

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEFAULT_DB_PATH = os.path.join(BASE_DIR, "database.db")


class AuthRepository:
    def __init__(self, db_path=None):
        self.db_path = db_path or DEFAULT_DB_PATH
        self._init_db()

    def _connect(self):
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_db(self):
        """Инициализация таблицы, если она не существует."""
        conn = self._connect()
        cursor = conn.cursor()
        # Создаем таблицу users, если её нет. 
        # Мы включаем основные поля, необходимые для работы системы.
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            username TEXT,
            email TEXT,
            password_hash TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        """)
        conn.commit()
        conn.close()

    def user_exists(self, user_id: str) -> bool:
        conn = self._connect()
        cursor = conn.cursor()
        try:
            cursor.execute("SELECT 1 FROM users WHERE id = ?", (user_id,))
            return cursor.fetchone() is not None
        finally:
            conn.close()

    def save_user_key(self, user_id: str, username: str, password_hash: str) -> bool:
        conn = self._connect()
        cursor = conn.cursor()
        email = f"{user_id}@telegram.bot"  # Заглушка, если email обязателен
        try:
            # Проверяем, существует ли пользователь, чтобы решить INSERT или UPDATE (для надежности)
            # Но по ТЗ регистрация - это INSERT. Если юзер есть - ошибка (обрабатывается выше).
            cursor.execute("""
                INSERT INTO users (id, username, email, password_hash, created_at)
                VALUES (?, ?, ?, ?, ?)
            """, (user_id, username, email, password_hash, datetime.now().isoformat()))
            conn.commit()
            return True
        except sqlite3.IntegrityError as e:
            logger.error(f"Ошибка БД (сохранение ключа): {e}")
            return False
        finally:
            conn.close()

    def update_user_key(self, user_id: str, password_hash: str) -> bool:
        conn = self._connect()
        cursor = conn.cursor()
        try:
            cursor.execute("""
                UPDATE users
                SET password_hash = ?, updated_at = ?
                WHERE id = ?
            """, (password_hash, datetime.now().isoformat(), user_id))
            conn.commit()
            return True
        except sqlite3.Error as e:
            logger.error(f"Ошибка БД (обновление ключа): {e}")
            return False
        finally:
            conn.close()

    def get_password_hash(self, user_id: str) -> str:
        conn = self._connect()
        cursor = conn.cursor()
        try:
            cursor.execute("SELECT password_hash FROM users WHERE id = ?", (user_id,))
            row = cursor.fetchone()
            return row["password_hash"] if row else None
        finally:
            conn.close()
