import logging
import sqlite3
from cryptography.fernet import Fernet
from .config import Config

logger = logging.getLogger(__name__)


class UserRepository:
    def __init__(self):
        try:
            self.cipher = Fernet(Config.MESSAGE_ENCRYPTION_KEY)
            self._init_db()
        except Exception as e:
            logger.error(f"Ошибка инициализации репозитория: {e}")
            raise

    def _init_db(self):
        conn = self._connect()
        try:
            # Create messages table if not exists
            conn.execute("""
                CREATE TABLE IF NOT EXISTS messages (
                    id TEXT PRIMARY KEY,
                    sender_id TEXT NOT NULL,
                    target_id TEXT,
                    channel_id TEXT,
                    content TEXT NOT NULL,
                    timestamp TEXT,
                    is_read INTEGER DEFAULT 0
                )
            """)

            # Check if channel_id column exists (migration)
            cursor = conn.execute("PRAGMA table_info(messages)")
            columns = [info[1] for info in cursor.fetchall()]
            if "channel_id" not in columns:
                logger.info(
                    "Миграция: Добавление столбца channel_id в таблицу messages")
                conn.execute("ALTER TABLE messages ADD COLUMN channel_id TEXT")

            conn.commit()
        except sqlite3.Error as e:
            logger.error(f"Ошибка инициализации БД: {e}")
        finally:
            conn.close()

    def _connect(self):
        return sqlite3.connect(Config.DB_PATH)

    def fetch_user_by_token(self, token):
        conn = self._connect()
        conn.row_factory = sqlite3.Row
        try:
            cursor = conn.execute(
                "SELECT * FROM users WHERE access_token = ?", (token,))
            row = cursor.fetchone()
            if row:
                return dict(row)
            return None
        except sqlite3.Error as e:
            logger.error(f"DB Error fetch_user_by_token: {e}")
            return None
        finally:
            conn.close()

    def bind_socket(self, user_id, socket_id):
        conn = self._connect()
        try:
            conn.execute(
                "UPDATE users SET socket_id = ?, status = 'online' WHERE id = ?",
                (socket_id, user_id)
            )
            conn.commit()
        except sqlite3.Error as e:
            logger.error(f"DB Error bind_socket: {e}")
        finally:
            conn.close()

    def release_socket(self, socket_id):
        conn = self._connect()
        try:
            conn.execute(
                "UPDATE users SET socket_id = NULL, status = 'offline' WHERE socket_id = ?",
                (socket_id,)
            )
            conn.commit()
        except sqlite3.Error as e:
            logger.error(f"DB Error release_socket: {e}")
        finally:
            conn.close()

    def find_user_by_socket(self, socket_id):
        conn = self._connect()
        conn.row_factory = sqlite3.Row
        try:
            cursor = conn.execute(
                "SELECT * FROM users WHERE socket_id = ?", (socket_id,)
            )
            row = cursor.fetchone()
            if row:
                return dict(row)
            return None
        except sqlite3.Error as e:
            logger.error(f"DB Error find_user_by_socket: {e}")
            return None
        finally:
            conn.close()

    def get_socket_by_user_id(self, user_id):
        conn = self._connect()
        conn.row_factory = sqlite3.Row
        try:
            cursor = conn.execute(
                "SELECT socket_id FROM users WHERE id = ?", (user_id,)
            )
            row = cursor.fetchone()
            if row and row["socket_id"]:
                return row["socket_id"]
            return None
        except sqlite3.Error as e:
            logger.error(f"DB Error get_socket_by_user_id: {e}")
            return None
        finally:
            conn.close()

    def save_message(self, msg_data):
        conn = self._connect()
        try:
            encrypted_content = self.cipher.encrypt(
                msg_data["content"].encode()).decode()

            # Support both direct messages and channel messages
            channel_id = msg_data.get("channel_id")

            if channel_id:
                query = """
                    INSERT INTO messages (id, sender_id, channel_id, content, timestamp, is_read)
                    VALUES (?, ?, ?, ?, ?, 0)
                """
                conn.execute(query, (
                    msg_data["id"],
                    msg_data["sender_id"],
                    channel_id,
                    encrypted_content,
                    msg_data["timestamp"]
                ))
            else:
                query = """
                    INSERT INTO messages (id, sender_id, target_id, content, timestamp, is_read)
                    VALUES (?, ?, ?, ?, ?, 0)
                """
                conn.execute(query, (
                    msg_data["id"],
                    msg_data["sender_id"],
                    msg_data["target_id"],
                    encrypted_content,
                    msg_data["timestamp"]
                ))
            conn.commit()
            return True
        except sqlite3.Error as e:
            logger.error(f"DB Error save_message: {e}")
            return False
        finally:
            conn.close()

    def mark_messages_as_read(self, message_ids, reader_id):
        # This logic is for DM. For channels, read status is more complex (per user).
        # Assuming DMs for now or simple logic.
        conn = self._connect()
        try:
            placeholders = ",".join(["?"] * len(message_ids))
            query = f"UPDATE messages SET is_read = 1 WHERE id IN ({placeholders}) AND target_id = ?"
            args = list(message_ids) + [reader_id]
            conn.execute(query, args)
            conn.commit()
        except sqlite3.Error as e:
            logger.error(f"DB Error mark_messages_as_read: {e}")
        finally:
            conn.close()

    def get_channel_owner(self, channel_id):
        conn = self._connect()
        conn.row_factory = sqlite3.Row
        try:
            cursor = conn.execute(
                "SELECT owner_id FROM channels WHERE id = ?", (channel_id,)
            )
            row = cursor.fetchone()
            if row:
                return row["owner_id"]
            return None
        except sqlite3.Error as e:
            logger.error(f"DB Error get_channel_owner: {e}")
            return None
        finally:
            conn.close()

    def get_channel_participants(self, channel_id):
        conn = self._connect()
        conn.row_factory = sqlite3.Row
        try:
            # Join channel_participants with users to get socket_id directly if needed
            # But just returning user_ids is safer for decoupling
            query = "SELECT user_id FROM channel_participants WHERE channel_id = ?"
            cursor = conn.execute(query, (channel_id,))
            rows = cursor.fetchall()
            return [row["user_id"] for row in rows]
        except sqlite3.Error as e:
            logger.error(f"DB Error get_channel_participants: {e}")
            return []
        finally:
            conn.close()

    def get_channel_history(self, channel_id, limit=50, offset=0):
        conn = self._connect()
        conn.row_factory = sqlite3.Row
        try:
            query = """
                SELECT * FROM messages 
                WHERE channel_id = ?
                ORDER BY timestamp DESC
                LIMIT ? OFFSET ?
            """
            cursor = conn.execute(query, (channel_id, limit, offset))
            rows = cursor.fetchall()

            messages = []
            for row in rows:
                msg = dict(row)
                try:
                    msg["content"] = self.cipher.decrypt(
                        msg["content"].encode()).decode()
                except Exception as e:
                    msg["content"] = "[Encrypted/Error]"
                    logger.error(
                        f"Ошибка дешифровки сообщения {msg['id']}: {e}")
                messages.append(msg)
            return messages
        except sqlite3.Error as err:
            logger.error(f"Ошибка БД (история канала): {err}")
            return []
        finally:
            conn.close()

    def get_online_users_count(self):
        conn = self._connect()
        try:
            cursor = conn.execute("SELECT COUNT(*) FROM users WHERE status = 'online'")
            return cursor.fetchone()[0]
        except sqlite3.Error as e:
            logger.error(f"DB Error get_online_users_count: {e}")
            return 0
        finally:
            conn.close()

    def update_socket_id_for_user(self, user_id, socket_id):
        conn = self._connect()
        conn.row_factory = sqlite3.Row
        try:
            conn.execute(
                "UPDATE users SET socket_id = ?, status = 'online' WHERE id = ?",
                (socket_id, user_id)
            )
            conn.commit()
            
            cursor = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,))
            row = cursor.fetchone()
            if row:
                return dict(row)
            return None
        except sqlite3.Error as e:
            logger.error(f"DB Error update_socket_id_for_user: {e}")
            return None
        finally:
            conn.close()

    def get_messages_history(self, user_id, target_id, limit=50, offset=0):
        conn = self._connect()
        conn.row_factory = sqlite3.Row
        try:
            # DM history between user_id and target_id
            query = """
                SELECT * FROM messages 
                WHERE (sender_id = ? AND target_id = ?) 
                   OR (sender_id = ? AND target_id = ?)
                ORDER BY timestamp DESC
                LIMIT ? OFFSET ?
            """
            cursor = conn.execute(query, (user_id, target_id, target_id, user_id, limit, offset))
            rows = cursor.fetchall()

            messages = []
            for row in rows:
                msg = dict(row)
                try:
                    msg["content"] = self.cipher.decrypt(
                        msg["content"].encode()).decode()
                except Exception as e:
                    msg["content"] = "[Encrypted/Error]"
                messages.append(msg)
            return messages
        except sqlite3.Error as err:
            logger.error(f"Ошибка БД (история сообщений): {err}")
            return []
        finally:
            conn.close()

    def search_users(self, query_str):
        conn = self._connect()
        conn.row_factory = sqlite3.Row
        try:
            # Simple search by username
            query = "SELECT id, username, avatar_url, status FROM users WHERE username LIKE ? LIMIT 20"
            cursor = conn.execute(query, (f"%{query_str}%",))
            rows = cursor.fetchall()
            return [dict(row) for row in rows]
        except sqlite3.Error as e:
            logger.error(f"DB Error search_users: {e}")
            return []
        finally:
            conn.close()

    def search_messages(self, user_id, target_id, query_str):
        conn = self._connect()
        conn.row_factory = sqlite3.Row
        try:
            sql = """
                SELECT * FROM messages 
                WHERE (sender_id = ? AND target_id = ?) 
                   OR (sender_id = ? AND target_id = ?)
                ORDER BY timestamp DESC
                LIMIT 500
            """
            cursor = conn.execute(sql, (user_id, target_id, target_id, user_id))
            rows = cursor.fetchall()
            
            results = []
            for row in rows:
                msg = dict(row)
                try:
                    decrypted = self.cipher.decrypt(msg["content"].encode()).decode()
                    if query_str.lower() in decrypted.lower():
                        msg["content"] = decrypted
                        results.append(msg)
                except:
                    continue
            return results
        except sqlite3.Error as e:
            logger.error(f"DB Error search_messages: {e}")
            return []
        finally:
            conn.close()
