import base64
import hashlib
import json
import logging
import os
import sqlite3
from datetime import datetime

from cryptography.fernet import Fernet
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes

from .config import Config

logger = logging.getLogger(__name__)


class UserRepository:
    def __init__(self):
        try:
            self.cipher = Fernet(Config.MESSAGE_ENCRYPTION_KEY)
            self.mt_key, self.mt_iv = self._derive_mtproto_key_iv(
                Config.MESSAGE_ENCRYPTION_KEY
            )
            self._init_db()
        except Exception as e:
            logger.error(f"Ошибка инициализации репозитория: {e}")
            raise

    def _init_db(self):
        conn = self._connect()
        try:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS messages (
                    id TEXT PRIMARY KEY,
                    sender_id TEXT NOT NULL,
                    target_id TEXT,
                    channel_id TEXT,
                    group_id TEXT,
                    reply_to TEXT,
                    content TEXT NOT NULL,
                    attachments TEXT,
                    type TEXT DEFAULT 'text',
                    timestamp TEXT,
                    is_read INTEGER DEFAULT 0,
                    is_deleted INTEGER DEFAULT 0
                )
            """)

            cursor = conn.execute("PRAGMA table_info(messages)")
            columns = [info[1] for info in cursor.fetchall()]
            if "channel_id" not in columns:
                logger.info(
                    "Миграция: Добавление столбца channel_id в таблицу messages")
                conn.execute("ALTER TABLE messages ADD COLUMN channel_id TEXT")

            if "group_id" not in columns:
                logger.info(
                    "Миграция: Добавление столбца group_id в таблицу messages")
                conn.execute("ALTER TABLE messages ADD COLUMN group_id TEXT")

            if "reply_to" not in columns:
                logger.info(
                    "Миграция: Добавление столбца reply_to в таблицу messages")
                conn.execute("ALTER TABLE messages ADD COLUMN reply_to TEXT")

            if "target_id" not in columns:
                logger.info(
                    "Миграция: Добавление столбца target_id в таблицу messages")
                conn.execute("ALTER TABLE messages ADD COLUMN target_id TEXT")

            if "type" not in columns:
                logger.info(
                    "Миграция: Добавление столбца type в таблицу messages")
                conn.execute(
                    "ALTER TABLE messages ADD COLUMN type TEXT DEFAULT 'text'")

            if "is_read" not in columns:
                logger.info(
                    "Миграция: Добавление столбца is_read в таблицу messages")
                conn.execute(
                    "ALTER TABLE messages ADD COLUMN is_read INTEGER DEFAULT 0")

            if "attachments" not in columns:
                logger.info(
                    "Миграция: Добавление столбца attachments в таблицу messages")
                conn.execute(
                    "ALTER TABLE messages ADD COLUMN attachments TEXT")

            if "is_deleted" not in columns:
                logger.info(
                    "Миграция: Добавление столбца is_deleted в таблицу messages")
                conn.execute(
                    "ALTER TABLE messages ADD COLUMN is_deleted INTEGER DEFAULT 0")

            conn.commit()
        except sqlite3.Error as e:
            logger.error(f"Ошибка инициализации БД: {e}")
        finally:
            conn.close()

    def _connect(self):
        return sqlite3.connect(Config.DB_PATH)

    def _derive_mtproto_key_iv(self, key_value):
        if isinstance(key_value, str):
            key_bytes = key_value.encode()
        else:
            key_bytes = key_value
        try:
            decoded = base64.urlsafe_b64decode(key_bytes)
            if len(decoded) >= 32:
                key_bytes = decoded
        except Exception:
            pass
        key = hashlib.sha256(key_bytes + b"key").digest()
        iv = hashlib.sha256(key_bytes + b"iv").digest()
        return key, iv

    def _mtproto_encrypt(self, plaintext):
        if plaintext is None:
            return None
        if isinstance(plaintext, str):
            data = plaintext.encode()
        else:
            data = plaintext
        length_bytes = len(data).to_bytes(4, "big")
        payload = length_bytes + data
        pad_len = (16 - (len(payload) % 16)) % 16
        if pad_len == 0:
            pad_len = 16
        payload += os.urandom(pad_len)
        iv = self.mt_iv
        iv1 = iv[:16]
        iv2 = iv[16:32]
        cipher = Cipher(algorithms.AES(self.mt_key), modes.ECB())
        encryptor = cipher.encryptor()
        prev_c = iv1
        prev_p = iv2
        out = bytearray()
        for i in range(0, len(payload), 16):
            block = payload[i:i + 16]
            xored = bytes(a ^ b for a, b in zip(block, prev_c))
            enc = encryptor.update(xored)
            c_block = bytes(a ^ b for a, b in zip(enc, prev_p))
            out.extend(c_block)
            prev_c = c_block
            prev_p = block
        encoded = base64.urlsafe_b64encode(bytes(out)).decode()
        return f"mt:{encoded}"

    def _mtproto_decrypt(self, ciphertext):
        if not ciphertext:
            return None
        if not isinstance(ciphertext, str) or not ciphertext.startswith("mt:"):
            return None
        b64 = ciphertext[3:]
        raw = base64.urlsafe_b64decode(b64.encode())
        iv = self.mt_iv
        iv1 = iv[:16]
        iv2 = iv[16:32]
        cipher = Cipher(algorithms.AES(self.mt_key), modes.ECB())
        decryptor = cipher.decryptor()
        prev_c = iv1
        prev_p = iv2
        out = bytearray()
        for i in range(0, len(raw), 16):
            c_block = raw[i:i + 16]
            xored = bytes(a ^ b for a, b in zip(c_block, prev_p))
            dec = decryptor.update(xored)
            p_block = bytes(a ^ b for a, b in zip(dec, prev_c))
            out.extend(p_block)
            prev_c = c_block
            prev_p = p_block
        if len(out) < 4:
            return None
        msg_len = int.from_bytes(out[:4], "big")
        body = out[4:4 + msg_len]
        return bytes(body)

    def _encrypt_payload(self, value):
        if value is None:
            return None
        if isinstance(value, str) and value.startswith("e2e:"):
            return value
        return self._mtproto_encrypt(value)

    def _decrypt_payload(self, value):
        if value is None:
            return None
        if isinstance(value, str) and value.startswith("e2e:"):
            return value
        if isinstance(value, str) and value.startswith("mt:"):
            try:
                decrypted = self._mtproto_decrypt(value)
                return decrypted.decode() if decrypted is not None else None
            except Exception:
                return None
        if isinstance(value, str):
            try:
                return self.cipher.decrypt(value.encode()).decode()
            except Exception:
                return value
        return value

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
            encrypted_content = self._encrypt_payload(msg_data["content"])
            encrypted_attachments = None
            if msg_data.get("attachments") is not None:
                if isinstance(msg_data["attachments"], str) and msg_data["attachments"].startswith("e2e:"):
                    encrypted_attachments = msg_data["attachments"]
                else:
                    attachments_json = json.dumps(
                        msg_data["attachments"], ensure_ascii=False)
                    encrypted_attachments = self._encrypt_payload(
                        attachments_json)

            channel_id = msg_data.get("channel_id")
            group_id = msg_data.get("group_id")
            reply_to = msg_data.get("reply_to")
            msg_type = msg_data.get("type", "text")

            if channel_id:
                query = """
                    INSERT INTO messages (id, sender_id, channel_id, reply_to, content, attachments, type, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """
                conn.execute(query, (
                    msg_data["id"],
                    msg_data["sender_id"],
                    channel_id,
                    reply_to,
                    encrypted_content,
                    encrypted_attachments,
                    msg_type,
                    msg_data["timestamp"],
                    msg_data["timestamp"]
                ))
            elif group_id:
                query = """
                    INSERT INTO messages (id, sender_id, group_id, reply_to, content, attachments, type, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """
                conn.execute(query, (
                    msg_data["id"],
                    msg_data["sender_id"],
                    group_id,
                    reply_to,
                    encrypted_content,
                    encrypted_attachments,
                    msg_type,
                    msg_data["timestamp"],
                    msg_data["timestamp"]
                ))
            else:
                query = """
                    INSERT INTO messages (id, sender_id, target_id, reply_to, content, attachments, type, created_at, updated_at, is_read)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
                """
                conn.execute(query, (
                    msg_data["id"],
                    msg_data["sender_id"],
                    msg_data.get("target_id"),
                    reply_to,
                    encrypted_content,
                    encrypted_attachments,
                    msg_type,
                    msg_data["timestamp"],
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

    def get_message_meta(self, message_id):
        conn = self._connect()
        conn.row_factory = sqlite3.Row
        try:
            cursor = conn.execute(
                "SELECT id, sender_id, target_id, channel_id, group_id, is_deleted FROM messages WHERE id = ?",
                (message_id,),
            )
            row = cursor.fetchone()
            return dict(row) if row else None
        except sqlite3.Error as e:
            logger.error(f"DB Error get_message_meta: {e}")
            return None
        finally:
            conn.close()

    def mark_message_deleted(self, message_id, sender_id):
        conn = self._connect()
        conn.row_factory = sqlite3.Row
        try:
            cursor = conn.execute(
                "SELECT id, sender_id FROM messages WHERE id = ?",
                (message_id,),
            )
            row = cursor.fetchone()
            if not row:
                return False, "not_found"
            if str(row["sender_id"]) != str(sender_id):
                return False, "forbidden"

            col_cursor = conn.execute("PRAGMA table_info(messages)")
            columns = [info[1] for info in col_cursor.fetchall()]

            encrypted_content = self._encrypt_payload("Сообщение удалено")
            set_clauses = ["content = ?",
                           "attachments = NULL", "is_deleted = 1"]
            params = [encrypted_content]
            if "updated_at" in columns:
                set_clauses.append("updated_at = ?")
                params.append(datetime.utcnow().isoformat())
            params.append(message_id)
            query = f"UPDATE messages SET {', '.join(set_clauses)} WHERE id = ?"
            conn.execute(query, params)
            conn.commit()
            return True, "ok"
        except sqlite3.Error as e:
            logger.error(f"DB Error mark_message_deleted: {e}")
            return False, "db_error"
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
            query = "SELECT user_id FROM channel_participants WHERE channel_id = ?"
            cursor = conn.execute(query, (channel_id,))
            rows = cursor.fetchall()
            return [row["user_id"] for row in rows]
        except sqlite3.Error as e:
            logger.error(f"DB Error get_channel_participants: {e}")
            return []
        finally:
            conn.close()

    def get_group_participants(self, group_id):
        conn = self._connect()
        conn.row_factory = sqlite3.Row
        try:
            query = "SELECT user_id FROM group_participants WHERE group_id = ?"
            cursor = conn.execute(query, (group_id,))
            rows = cursor.fetchall()
            return [row["user_id"] for row in rows]
        except sqlite3.Error as e:
            logger.error(f"DB Error get_group_participants: {e}")
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
                ORDER BY created_at DESC
                LIMIT ? OFFSET ?
            """
            cursor = conn.execute(query, (channel_id, limit, offset))
            rows = cursor.fetchall()

            messages = []
            for row in rows:
                msg = dict(row)
                if "created_at" in msg:
                    msg["timestamp"] = msg.pop("created_at")
                try:
                    msg["content"] = self._decrypt_payload(msg["content"])
                except Exception as e:
                    content_value = msg.get("content")
                    if isinstance(content_value, str) and not content_value.startswith("mt:") and not content_value.startswith("gAAAA"):
                        msg["content"] = content_value
                    else:
                        msg["content"] = "[Не удалось расшифровать]"
                    logger.error(
                        f"Ошибка дешифровки сообщения {msg['id']}: {e}")
                if msg.get("attachments"):
                    try:
                        decrypted = self._decrypt_payload(msg["attachments"])
                        if isinstance(decrypted, str) and decrypted.startswith("e2e:"):
                            msg["attachments"] = decrypted
                        else:
                            msg["attachments"] = json.loads(decrypted)
                    except Exception:
                        if isinstance(msg["attachments"], str):
                            try:
                                msg["attachments"] = json.loads(
                                    msg["attachments"])
                            except Exception:
                                pass
                        pass
                messages.append(msg)
            return messages
        except sqlite3.Error as err:
            logger.error(f"Ошибка БД (история канала): {err}")
            return []
        finally:
            conn.close()

    def get_group_history(self, group_id, limit=50, offset=0):
        conn = self._connect()
        conn.row_factory = sqlite3.Row
        try:
            query = """
                SELECT * FROM messages
                WHERE group_id = ?
                ORDER BY created_at DESC
                LIMIT ? OFFSET ?
            """
            cursor = conn.execute(query, (group_id, limit, offset))
            rows = cursor.fetchall()

            messages = []
            for row in rows:
                msg = dict(row)
                if "created_at" in msg:
                    msg["timestamp"] = msg.pop("created_at")
                try:
                    msg["content"] = self._decrypt_payload(msg["content"])
                except Exception as e:
                    content_value = msg.get("content")
                    if isinstance(content_value, str) and not content_value.startswith("mt:") and not content_value.startswith("gAAAA"):
                        msg["content"] = content_value
                    else:
                        msg["content"] = "[Не удалось расшифровать]"
                    logger.error(
                        f"Ошибка дешифровки сообщения {msg['id']}: {e}")
                if msg.get("attachments"):
                    try:
                        decrypted = self._decrypt_payload(msg["attachments"])
                        if isinstance(decrypted, str) and decrypted.startswith("e2e:"):
                            msg["attachments"] = decrypted
                        else:
                            msg["attachments"] = json.loads(decrypted)
                    except Exception as e:
                        attachments_value = msg.get("attachments")
                        if isinstance(attachments_value, str):
                            try:
                                msg["attachments"] = json.loads(
                                    attachments_value)
                            except Exception:
                                msg["attachments"] = None
                        else:
                            msg["attachments"] = None
                        logger.error(
                            f"Ошибка дешифровки вложений {msg['id']}: {e}")
                messages.append(msg)
            return messages
        except sqlite3.Error as err:
            logger.error(f"Ошибка БД (история группы): {err}")
            return []
        finally:
            conn.close()

    def get_online_users_count(self):
        conn = self._connect()
        try:
            cursor = conn.execute(
                "SELECT COUNT(*) FROM users WHERE status = 'online'")
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

            cursor = conn.execute(
                "SELECT * FROM users WHERE id = ?", (user_id,))
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
            query = """
                SELECT * FROM messages 
                WHERE (sender_id = ? AND target_id = ?) 
                   OR (sender_id = ? AND target_id = ?)
                ORDER BY created_at DESC
                LIMIT ? OFFSET ?
            """
            cursor = conn.execute(
                query, (user_id, target_id, target_id, user_id, limit, offset))
            rows = cursor.fetchall()

            messages = []
            for row in rows:
                msg = dict(row)
                if "created_at" in msg:
                    msg["timestamp"] = msg.pop("created_at")
                try:
                    msg["content"] = self._decrypt_payload(msg["content"])
                except Exception as e:
                    content_value = msg.get("content")
                    if isinstance(content_value, str) and not content_value.startswith("mt:") and not content_value.startswith("gAAAA"):
                        msg["content"] = content_value
                    else:
                        msg["content"] = "[Не удалось расшифровать]"
                    logger.error(
                        f"Ошибка дешифровки сообщения {msg['id']}: {e}")
                if msg.get("attachments"):
                    try:
                        decrypted = self._decrypt_payload(msg["attachments"])
                        if isinstance(decrypted, str) and decrypted.startswith("e2e:"):
                            msg["attachments"] = decrypted
                        else:
                            msg["attachments"] = json.loads(decrypted)
                    except Exception as e:
                        attachments_value = msg.get("attachments")
                        if isinstance(attachments_value, str):
                            try:
                                msg["attachments"] = json.loads(
                                    attachments_value)
                            except Exception:
                                msg["attachments"] = None
                        else:
                            msg["attachments"] = None
                        logger.error(
                            f"Ошибка дешифровки вложений {msg['id']}: {e}")
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
                ORDER BY created_at DESC
                LIMIT 500
            """
            cursor = conn.execute(
                sql, (user_id, target_id, target_id, user_id))
            rows = cursor.fetchall()

            results = []
            for row in rows:
                msg = dict(row)
                try:
                    decrypted = self._decrypt_payload(msg["content"])
                    if decrypted and query_str.lower() in decrypted.lower():
                        msg["content"] = decrypted
                        results.append(msg)
                except Exception:
                    continue
            return results
        except sqlite3.Error as e:
            logger.error(f"DB Error search_messages: {e}")
            return []
        finally:
            conn.close()
