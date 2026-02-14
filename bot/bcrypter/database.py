import logging
import os
import secrets
import sqlite3
from datetime import datetime

logger = logging.getLogger(__name__)
BASE_DIR = os.path.dirname(os.path.dirname(
    os.path.dirname(os.path.abspath(__file__))))
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
        """Инициализация таблицы, если она не существует. Используем схему совместимую с бэкендом."""
        conn = self._connect()
        cursor = conn.cursor()
        cursor.execute(
            "\n            CREATE TABLE IF NOT EXISTS users (\n                id TEXT PRIMARY KEY,\n                username TEXT UNIQUE NOT NULL,\n                email TEXT UNIQUE NOT NULL,\n                access_token TEXT,\n                refresh_token TEXT,\n                password_hash TEXT NOT NULL,\n                avatar_url TEXT DEFAULT NULL,\n                is_verified INTEGER DEFAULT 0,\n                socket_id TEXT,\n                is_blocked INTEGER DEFAULT 0,\n                is_blocked_at TIMESTAMP DEFAULT NULL,\n                role TEXT DEFAULT 'User',\n                status TEXT DEFAULT 'offline',\n                is_messaging INTEGER DEFAULT 0,\n                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,\n                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP\n            );\n            "
        )
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

    def save_user_key(self, user_id: str, username: str, password_hash: str, avatar_url: str = None) -> bool:
        conn = self._connect()
        cursor = conn.cursor()
        email = f"{user_id}@telegram.bot"
        access_token = secrets.token_hex(32)
        refresh_token = secrets.token_hex(32)
        try:
            cursor.execute(
                "\n                INSERT INTO users (\n                    id, username, email, password_hash, is_verified, \n                    access_token, refresh_token, \n                    role, status, is_blocked, is_messaging, created_at, avatar_url\n                )\n                VALUES (?, ?, ?, ?, 1, ?, ?, 'User', 'offline', 0, 0, ?, ?)\n                ",
                (
                    user_id,
                    username,
                    email,
                    password_hash,
                    access_token,
                    refresh_token,
                    datetime.now().isoformat(),
                    avatar_url,
                ),
            )
            conn.commit()
            return True
        except sqlite3.IntegrityError:
            return False
        finally:
            conn.close()

    def update_user_key(self, user_id: str, password_hash: str, avatar_url: str = None) -> bool:
        conn = self._connect()
        cursor = conn.cursor()
        try:
            if avatar_url:
                cursor.execute(
                    "\n                UPDATE users\n                SET password_hash = ?, updated_at = ?, avatar_url = ?\n                WHERE id = ?\n            ",
                    (password_hash, datetime.now().isoformat(), avatar_url, user_id),
                )
            else:
                cursor.execute(
                    "\n                UPDATE users\n                SET password_hash = ?, updated_at = ?\n                WHERE id = ?\n            ",
                    (password_hash, datetime.now().isoformat(), user_id),
                )
            conn.commit()
            return True
        except sqlite3.Error:
            return False
        finally:
            conn.close()

    def get_password_hash(self, user_id: str) -> str:
        conn = self._connect()
        cursor = conn.cursor()
        try:
            cursor.execute(
                "SELECT password_hash FROM users WHERE id = ?", (user_id,))
            row = cursor.fetchone()
            return row["password_hash"] if row else None
        finally:
            conn.close()

    def get_user_by_email(self, email: str):
        conn = self._connect()
        cursor = conn.cursor()
        try:
            cursor.execute("SELECT * FROM users WHERE email = ?", (email,))
            row = cursor.fetchone()
            return dict(row) if row else None
        finally:
            conn.close()

    def set_premium(self, user_id: str, premium_status: int) -> bool:
        conn = self._connect()
        cursor = conn.cursor()
        try:
            cursor.execute(
                "UPDATE users SET premium = ? WHERE id = ?", (premium_status, user_id))
            conn.commit()
            return True
        except sqlite3.Error:
            return False
        finally:
            conn.close()
