import logging
import os
import secrets
import psycopg2
from psycopg2.extras import RealDictCursor
from datetime import datetime

logger = logging.getLogger(__name__)
def _build_postgres_dsn() -> str:
    explicit = os.environ.get("POSTGRES_URL") or os.environ.get("DATABASE_URL")
    if explicit:
        return explicit.replace("postgresql+psycopg2://", "postgresql://")
    host = os.environ.get("POSTGRES_HOST")
    if not host:
        raise RuntimeError(
            "PostgreSQL не настроен для bot. Установите POSTGRES_* или DATABASE_URL."
        )
    user = os.environ.get("POSTGRES_USER", "postgres")
    password = os.environ.get("POSTGRES_PASSWORD", "")
    port = os.environ.get("POSTGRES_PORT", "5432")
    db = os.environ.get("POSTGRES_DB", "postgres")
    auth = f"{user}@"
    if password:
        auth = f"{user}:{password}@"
    return f"postgresql://{auth}{host}:{port}/{db}"

class AuthRepository:
    def __init__(self, db_path=None):
        self.db_path = db_path or _build_postgres_dsn()
        self._init_db()

    def _connect(self):
        conn = psycopg2.connect(self.db_path, cursor_factory=RealDictCursor)
        return conn

    def _init_db(self):
        conn = self._connect()
        cursor = conn.cursor()
        cursor.execute(

        )
        conn.commit()
        conn.close()

    def user_exists(self, user_id: str) -> bool:
        conn = self._connect()
        cursor = conn.cursor()
        try:
            cursor.execute("SELECT 1 FROM users WHERE id = %s", (user_id,))
            return cursor.fetchone() is not None
        finally:
            conn.close()

    def save_user_key(
            self,
            user_id: str,
            username: str,
            password_hash: str,
            avatar_url: str = None) -> bool:
        conn = self._connect()
        cursor = conn.cursor()
        email = f"{user_id}@telegram.bot"
        access_token = secrets.token_hex(32)
        refresh_token = secrets.token_hex(32)
        try:
            cursor.execute(
                ,
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
        except psycopg2.IntegrityError:
            return False
        finally:
            conn.close()

    def update_user_key(
        self, user_id: str, password_hash: str, avatar_url: str = None
    ) -> bool:
        conn = self._connect()
        cursor = conn.cursor()
        try:
            if avatar_url:
                cursor.execute(
                    ,
                    (
                        password_hash,
                        datetime.now().isoformat(),
                        avatar_url,
                        user_id,
                    ),
                )
            else:
                cursor.execute(
                    ,
                    (password_hash, datetime.now().isoformat(), user_id),
                )
            conn.commit()
            return True
        except psycopg2.Error:
            return False
        finally:
            conn.close()

    def get_password_hash(self, user_id: str) -> str:
        conn = self._connect()
        cursor = conn.cursor()
        try:
            cursor.execute(
                "SELECT password_hash FROM users WHERE id = %s", (user_id,))
            row = cursor.fetchone()
            return row["password_hash"] if row else None
        finally:
            conn.close()

    def get_user_by_email(self, email: str):
        conn = self._connect()
        cursor = conn.cursor()
        try:
            cursor.execute("SELECT * FROM users WHERE email = %s", (email,))
            row = cursor.fetchone()
            return dict(row) if row else None
        finally:
            conn.close()

    def set_premium(self, user_id: str, premium_status: int) -> bool:
        conn = self._connect()
        cursor = conn.cursor()
        try:
            cursor.execute(
                "UPDATE users SET premium = %s WHERE id = %s", (
                    premium_status, user_id)
            )
            conn.commit()
            return True
        except psycopg2.Error:
            return False
        finally:
            conn.close()
