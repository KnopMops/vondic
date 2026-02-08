import logging
import sqlite3

from .config import Config

logger = logging.getLogger(__name__)


class UserRepository:
    def __init__(self, db_path=None):
        self.db_path = db_path or Config.DB_PATH

    def _connect(self):
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def fetch_user_by_token(self, token):
        conn = self._connect()
        cursor = conn.cursor()
        try:
            cursor.execute(
                "SELECT * FROM users WHERE access_token = ?", (token,))
            row = cursor.fetchone()
            return dict(row) if row else None
        except sqlite3.Error as err:
            logger.error(f"Ошибка БД (поиск по токену): {err}")
            return None
        finally:
            conn.close()

    def bind_socket(self, user_id, socket_id):
        conn = self._connect()
        cursor = conn.cursor()
        try:
            cursor.execute(
                "UPDATE users SET socket_id = ?, status = 'online' WHERE id = ?", (
                    socket_id, user_id)
            )
            conn.commit()
            logger.info(
                f"Привязан socket_id для пользователя {user_id} -> {socket_id} (online)")
        except sqlite3.Error as err:
            logger.error(f"Ошибка БД (привязка сокета): {err}")
        finally:
            conn.close()

    def release_socket(self, socket_id):
        conn = self._connect()
        cursor = conn.cursor()
        try:
            cursor.execute(
                "UPDATE users SET socket_id = NULL, status = 'offline' WHERE socket_id = ?", (
                    socket_id,)
            )
            conn.commit()
            if cursor.rowcount > 0:
                logger.info(f"Очищен socket_id {socket_id} из БД (offline)")
        except sqlite3.Error as err:
            logger.error(f"Ошибка БД (очистка сокета): {err}")
        finally:
            conn.close()

    def find_user_by_socket(self, socket_id):
        conn = self._connect()
        cursor = conn.cursor()
        try:
            cursor.execute(
                "SELECT * FROM users WHERE socket_id = ?", (socket_id,))
            row = cursor.fetchone()
            return dict(row) if row else None
        except sqlite3.Error as err:
            logger.error(f"Ошибка БД (поиск по сокету): {err}")
            return None
        finally:
            conn.close()

    def get_socket_by_user_id(self, user_id):
        conn = self._connect()
        cursor = conn.cursor()
        try:
            cursor.execute(
                "SELECT socket_id FROM users WHERE id = ?", (user_id,))
            row = cursor.fetchone()
            return row["socket_id"] if row else None
        except sqlite3.Error as err:
            logger.error(f"Ошибка БД (поиск сокета по ID): {err}")
            return None
        finally:
            conn.close()

    def update_socket_id_for_user(self, user_id, socket_id):
        conn = self._connect()
        cursor = conn.cursor()
        try:
            # Сначала проверяем существование пользователя
            cursor.execute("SELECT id FROM users WHERE id = ?", (user_id,))
            if not cursor.fetchone():
                return None

            # Обновляем только socket_id
            cursor.execute(
                "UPDATE users SET socket_id = ? WHERE id = ?",
                (socket_id, user_id),
            )
            conn.commit()

            # Получаем обновленные данные пользователя
            cursor.execute("SELECT * FROM users WHERE id = ?", (user_id,))
            row = cursor.fetchone()
            return dict(row) if row else None
        except sqlite3.Error as err:
            logger.error(f"Ошибка БД (обновление сокета): {err}")
            return None
        finally:
            conn.close()
