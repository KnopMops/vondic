import asyncio
import base64
import hashlib
import json
import logging
import os
import threading
from datetime import datetime

import asyncpg
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
            self._loop = asyncio.new_event_loop()
            self._loop_thread = threading.Thread(
                target=self._loop.run_forever,
                daemon=True,
            )
            self._loop_thread.start()
            self._init_db()
        except Exception as e:
            logger.error(f"Ошибка инициализации репозитория: {e}")
            raise

    def _init_db(self):
        try:
            self._run(self._init_db_async())
        except Exception as e:
            logger.error(f"Ошибка инициализации БД: {e}")

    async def _init_db_async(self):
        conn = await self._connect()
        try:
            await conn.execute("""
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
                    created_at TEXT,
                    updated_at TEXT,
                    is_read INTEGER DEFAULT 0,
                    is_deleted INTEGER DEFAULT 0
                )
            """)
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS videos (
                    id TEXT PRIMARY KEY,
                    author_id TEXT NOT NULL,
                    title TEXT NOT NULL,
                    description TEXT,
                    url TEXT NOT NULL,
                    poster TEXT,
                    duration INTEGER,
                    created_at TEXT,
                    updated_at TEXT,
                    views INTEGER DEFAULT 0,
                    likes INTEGER DEFAULT 0,
                    is_deleted INTEGER DEFAULT 0,
                    tags TEXT
                )
            """)
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS users (
                    id TEXT PRIMARY KEY,
                    username TEXT,
                    email TEXT,
                    access_token TEXT,
                    refresh_token TEXT,
                    password_hash TEXT,
                    avatar_url TEXT,
                    is_verified INTEGER DEFAULT 0,
                    socket_id TEXT,
                    is_blocked INTEGER DEFAULT 0,
                    is_blocked_at TEXT,
                    blocked_by_admin TEXT,
                    role TEXT,
                    status TEXT,
                    balance REAL DEFAULT 0,
                    premium INTEGER DEFAULT 0,
                    premium_started_at TEXT,
                    premium_expired_at TEXT,
                    disk_usage INTEGER DEFAULT 0,
                    is_messaging INTEGER DEFAULT 0,
                    telegram_id TEXT,
                    link_key TEXT,
                    two_factor_enabled INTEGER DEFAULT 0,
                    two_factor_method TEXT,
                    two_factor_secret TEXT,
                    two_factor_email_code TEXT,
                    two_factor_email_code_expires TEXT,
                    login_alert_enabled INTEGER DEFAULT 0,
                    profile_bg_theme TEXT,
                    profile_bg_gradient TEXT,
                    profile_bg_image TEXT,
                    gifts TEXT,
                    storis TEXT,
                    is_developer INTEGER DEFAULT 0,
                    api_key_hash TEXT,
                    api_key TEXT,
                    cloud_password_hash TEXT,
                    cloud_password_reset_month INTEGER DEFAULT NULL,
                    cloud_password_reset_count INTEGER DEFAULT 0,
                    created_at TEXT,
                    updated_at TEXT,
                    video_channel_id TEXT,
                    video_subscribers INTEGER DEFAULT 0,
                    video_count INTEGER DEFAULT 0,
                    video_likes TEXT,
                    video_watch_later TEXT,
                    video_history TEXT
                )
            """)
            await conn.execute(
                "ALTER TABLE messages ADD COLUMN IF NOT EXISTS channel_id TEXT"
            )
            await conn.execute(
                "ALTER TABLE messages ADD COLUMN IF NOT EXISTS group_id TEXT"
            )
            await conn.execute(
                "ALTER TABLE messages ADD COLUMN IF NOT EXISTS reply_to TEXT"
            )
            await conn.execute(
                "ALTER TABLE messages ADD COLUMN IF NOT EXISTS target_id TEXT"
            )
            await conn.execute(
                "ALTER TABLE messages ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'text'"
            )
            await conn.execute(
                "ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_read INTEGER DEFAULT 0"
            )
            await conn.execute(
                "ALTER TABLE messages ADD COLUMN IF NOT EXISTS attachments TEXT"
            )
            await conn.execute(
                "ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_deleted INTEGER DEFAULT 0"
            )
            await conn.execute(
                "ALTER TABLE messages ADD COLUMN IF NOT EXISTS created_at TEXT"
            )
            await conn.execute(
                "ALTER TABLE messages ADD COLUMN IF NOT EXISTS updated_at TEXT"
            )
            await conn.execute(
                "ALTER TABLE users ADD COLUMN IF NOT EXISTS socket_id TEXT"
            )
            await conn.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS status TEXT")
            await conn.execute(
                "ALTER TABLE users ADD COLUMN IF NOT EXISTS premium INTEGER DEFAULT 0"
            )
            await conn.execute(
                "ALTER TABLE users ADD COLUMN IF NOT EXISTS video_channel_id TEXT"
            )
            await conn.execute(
                "ALTER TABLE users ADD COLUMN IF NOT EXISTS video_subscribers INTEGER DEFAULT 0"
            )
            await conn.execute(
                "ALTER TABLE users ADD COLUMN IF NOT EXISTS video_count INTEGER DEFAULT 0"
            )
            await conn.execute(
                "ALTER TABLE users ADD COLUMN IF NOT EXISTS video_likes TEXT"
            )
            await conn.execute(
                "ALTER TABLE users ADD COLUMN IF NOT EXISTS video_watch_later TEXT"
            )
            await conn.execute(
                "ALTER TABLE users ADD COLUMN IF NOT EXISTS video_history TEXT"
            )
        finally:
            await conn.close()

    async def _connect(self):
        if not Config.DATABASE_URL:
            raise RuntimeError("DATABASE_URL is not configured")
        return await asyncpg.connect(Config.DATABASE_URL)

    def _run(self, coro):
        future = asyncio.run_coroutine_threadsafe(coro, self._loop)
        return future.result()

    def _prepare(self, query, params):
        if not params:
            return query, []
        segments = query.split("?")
        if len(segments) - 1 != len(params):
            raise ValueError("Placeholder count does not match params")
        parts = [segments[0]]
        for i, segment in enumerate(segments[1:], start=1):
            parts.append(f"${i}")
            parts.append(segment)
        return "".join(parts), list(params)

    async def _execute(self, query, params=None):
        conn = await self._connect()
        try:
            prepared, args = self._prepare(query, params or [])
            return await conn.execute(prepared, *args)
        finally:
            await conn.close()

    async def _fetch(self, query, params=None):
        conn = await self._connect()
        try:
            prepared, args = self._prepare(query, params or [])
            return await conn.fetch(prepared, *args)
        finally:
            await conn.close()

    async def _fetchrow(self, query, params=None):
        conn = await self._connect()
        try:
            prepared, args = self._prepare(query, params or [])
            return await conn.fetchrow(prepared, *args)
        finally:
            await conn.close()

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
            block = payload[i: i + 16]
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
            c_block = raw[i: i + 16]
            xored = bytes(a ^ b for a, b in zip(c_block, prev_p))
            dec = decryptor.update(xored)
            p_block = bytes(a ^ b for a, b in zip(dec, prev_c))
            out.extend(p_block)
            prev_c = c_block
            prev_p = p_block
        if len(out) < 4:
            return None
        msg_len = int.from_bytes(out[:4], "big")
        body = out[4: 4 + msg_len]
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
        try:
            row = self._run(
                self._fetchrow(
                    "SELECT * FROM users WHERE access_token = ?",
                    (token,),
                )
            )
            return dict(row) if row else None
        except Exception as e:
            logger.error(f"DB Error fetch_user_by_token: {e}")
            return None

    def bind_socket(self, user_id, socket_id):
        try:
            self._run(
                self._execute(
                    "UPDATE users SET socket_id = ?, status = 'online' WHERE id = ?",
                    (socket_id, user_id),
                )
            )
        except Exception as e:
            logger.error(f"DB Error bind_socket: {e}")

    def release_socket(self, socket_id):
        try:
            self._run(
                self._execute(
                    "UPDATE users SET socket_id = NULL, status = 'offline' WHERE socket_id = ?",
                    (socket_id,),
                )
            )
        except Exception as e:
            logger.error(f"DB Error release_socket: {e}")

    def find_user_by_socket(self, socket_id):
        try:
            row = self._run(
                self._fetchrow(
                    "SELECT * FROM users WHERE socket_id = ?",
                    (socket_id,),
                )
            )
            return dict(row) if row else None
        except Exception as e:
            logger.error(f"DB Error find_user_by_socket: {e}")
            return None

    def get_socket_by_user_id(self, user_id):
        try:
            row = self._run(
                self._fetchrow(
                    "SELECT socket_id FROM users WHERE id = ?",
                    (user_id,),
                )
            )
            if row and row.get("socket_id"):
                return row["socket_id"]
            return None
        except Exception as e:
            logger.error(f"DB Error get_socket_by_user_id: {e}")
            return None

    def save_message(self, msg_data):
        try:
            encrypted_content = self._encrypt_payload(msg_data["content"])
            encrypted_attachments = None
            if msg_data.get("attachments") is not None:
                if isinstance(msg_data["attachments"], str) and msg_data[
                    "attachments"
                ].startswith("e2e:"):
                    # For PostgreSQL JSON column, we must store valid JSON.
                    # Wrap the E2E string in quotes (JSON string).
                    encrypted_attachments = json.dumps(msg_data["attachments"])
                else:
                    attachments_json = json.dumps(
                        msg_data["attachments"], ensure_ascii=False
                    )
                    # _encrypt_payload returns a base64 string, which is not valid JSON on its own.
                    # It must be wrapped in quotes too.
                    encrypted_payload = self._encrypt_payload(attachments_json)
                    encrypted_attachments = json.dumps(encrypted_payload)

            channel_id = msg_data.get("channel_id")
            group_id = msg_data.get("group_id")
            reply_to = msg_data.get("reply_to")
            msg_type = msg_data.get("type", "text")

            # Ensure timestamp is a datetime object
            ts = msg_data.get("timestamp")
            if isinstance(ts, str):
                try:
                    ts = datetime.fromisoformat(ts)
                except ValueError:
                    ts = datetime.now()
            elif not isinstance(ts, datetime):
                ts = datetime.now()

            if channel_id:
                query = """
                    INSERT INTO messages (id, sender_id, channel_id, reply_to, content, attachments, type, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """
                self._run(
                    self._execute(
                        query,
                        (
                            msg_data["id"],
                            msg_data["sender_id"],
                            channel_id,
                            reply_to,
                            encrypted_content,
                            encrypted_attachments,
                            msg_type,
                            ts,
                            ts,
                        ),
                    )
                )
            elif group_id:
                query = """
                    INSERT INTO messages (id, sender_id, group_id, reply_to, content, attachments, type, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """
                self._run(
                    self._execute(
                        query,
                        (
                            msg_data["id"],
                            msg_data["sender_id"],
                            group_id,
                            reply_to,
                            encrypted_content,
                            encrypted_attachments,
                            msg_type,
                            ts,
                            ts,
                        ),
                    )
                )
            else:
                query = """
                    INSERT INTO messages (id, sender_id, target_id, reply_to, content, attachments, type, created_at, updated_at, is_read)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
                """
                self._run(
                    self._execute(
                        query,
                        (
                            msg_data["id"],
                            msg_data["sender_id"],
                            msg_data.get("target_id"),
                            reply_to,
                            encrypted_content,
                            encrypted_attachments,
                            msg_type,
                            ts,
                            ts,
                        ),
                    )
                )
            return True, None
        except Exception as e:
            logger.error(f"DB Error save_message: {e}")
            return False, str(e)

    def save_video(self, video_data):
        try:
            created_at = video_data.get("created_at")
            if isinstance(created_at, str):
                try:
                    created_at = datetime.fromisoformat(created_at)
                except ValueError:
                    created_at = datetime.now()
            elif not isinstance(created_at, datetime):
                created_at = datetime.now()

            updated_at = video_data.get("updated_at")
            if isinstance(updated_at, str):
                try:
                    updated_at = datetime.fromisoformat(updated_at)
                except ValueError:
                    updated_at = datetime.now()
            elif not isinstance(updated_at, datetime):
                updated_at = datetime.now()

            query = """
                INSERT INTO videos (id, author_id, title, description, url, poster, duration, created_at, updated_at, views, likes, is_deleted, tags)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """
            tags_json = None
            if video_data.get("tags") is not None:
                tags_json = json.dumps(video_data["tags"], ensure_ascii=False)
            self._run(
                self._execute(
                    query,
                    (
                        video_data["id"],
                        video_data["author_id"],
                        video_data["title"],
                        video_data.get("description"),
                        video_data["url"],
                        video_data.get("poster"),
                        video_data.get("duration"),
                        created_at,
                        updated_at,
                        video_data.get("views", 0),
                        video_data.get("likes", 0),
                        video_data.get("is_deleted", 0),
                        tags_json,
                    ),
                )
            )
            return True
        except Exception as e:
            logger.error(f"DB Error save_video: {e}")
            return False

    def update_video(self, video_id, updates):
        try:
            set_parts = []
            params = []
            for key, value in updates.items():
                if key == "tags":
                    value = (
                        json.dumps(value, ensure_ascii=False)
                        if value is not None
                        else None
                    )
                set_parts.append(f"{key} = ?")
                params.append(value)
            params.append(video_id)
            query = f"UPDATE videos SET {', '.join(set_parts)} WHERE id = ?"
            self._run(self._execute(query, params))
            return True
        except Exception as e:
            logger.error(f"DB Error update_video: {e}")
            return False

    def delete_video(self, video_id):
        try:
            self._run(
                self._execute(
                    "UPDATE videos SET is_deleted = 1 WHERE id = ?",
                    (video_id,),
                )
            )
            return True
        except Exception as e:
            logger.error(f"DB Error delete_video: {e}")
            return False

    def get_video_by_id(self, video_id):
        try:
            row = self._run(
                self._fetchrow(
                    "SELECT * FROM videos WHERE id = ?",
                    (video_id,),
                )
            )
            if not row:
                return None
            data = dict(row)
            if data.get("tags"):
                try:
                    data["tags"] = json.loads(data["tags"])
                except Exception:
                    pass
            return data
        except Exception as e:
            logger.error(f"DB Error get_video_by_id: {e}")
            return None

    def list_videos(self, limit=20, offset=0, author_id=None):
        try:
            if author_id:
                rows = self._run(
                    self._fetch(
                        "SELECT * FROM videos WHERE author_id = ? AND is_deleted = 0 ORDER BY created_at DESC LIMIT ? OFFSET ?",
                        (author_id, limit, offset),
                    )
                )
            else:
                rows = self._run(
                    self._fetch(
                        "SELECT * FROM videos WHERE is_deleted = 0 ORDER BY created_at DESC LIMIT ? OFFSET ?",
                        (limit, offset),
                    )
                )
            out = []
            for row in rows:
                item = dict(row)
                if item.get("tags"):
                    try:
                        item["tags"] = json.loads(item["tags"])
                    except Exception:
                        pass
                out.append(item)
            return out
        except Exception as e:
            logger.error(f"DB Error list_videos: {e}")
            return []

    def mark_messages_as_read(self, message_ids, reader_id):
        try:
            placeholders = ",".join(["?"] * len(message_ids))
            query = f"UPDATE messages SET is_read = 1 WHERE id IN ({placeholders}) AND target_id = ?"
            args = list(message_ids) + [reader_id]
            self._run(self._execute(query, args))
        except Exception as e:
            logger.error(f"DB Error mark_messages_as_read: {e}")

    def get_message_meta(self, message_id):
        try:
            row = self._run(
                self._fetchrow(
                    "SELECT id, sender_id, target_id, channel_id, group_id, is_deleted FROM messages WHERE id = ?",
                    (message_id,),
                )
            )
            return dict(row) if row else None
        except Exception as e:
            logger.error(f"DB Error get_message_meta: {e}")
            return None

    def mark_message_deleted(self, message_id, sender_id):
        try:
            row = self._run(
                self._fetchrow(
                    "SELECT id, sender_id FROM messages WHERE id = ?",
                    (message_id,),
                )
            )
            if not row:
                return False, "not_found"
            if str(row["sender_id"]) != str(sender_id):
                return False, "forbidden"
            column_rows = self._run(
                self._fetch(
                    "SELECT column_name FROM information_schema.columns WHERE table_name = 'messages'"
                )
            )
            columns = [row["column_name"] for row in column_rows]
            encrypted_content = self._encrypt_payload("Сообщение удалено")
            set_clauses = ["content = ?",
                           "attachments = NULL", "is_deleted = 1"]
            params = [encrypted_content]
            if "updated_at" in columns:
                set_clauses.append("updated_at = ?")
                params.append(datetime.utcnow().isoformat())
            params.append(message_id)
            query = f"UPDATE messages SET {', '.join(set_clauses)} WHERE id = ?"
            self._run(self._execute(query, params))
            return True, "ok"
        except Exception as e:
            logger.error(f"DB Error mark_message_deleted: {e}")
            return False, "db_error"

    def get_channel_owner(self, channel_id):
        try:
            row = self._run(
                self._fetchrow(
                    "SELECT owner_id FROM channels WHERE id = ?",
                    (channel_id,),
                )
            )
            if row:
                return row["owner_id"]
            return None
        except Exception as e:
            logger.error(f"DB Error get_channel_owner: {e}")
            return None

    def get_channel_participants(self, channel_id):
        try:
            query = "SELECT user_id FROM channel_participants WHERE channel_id = ?"
            rows = self._run(self._fetch(query, (channel_id,)))
            return [row["user_id"] for row in rows]
        except Exception as e:
            logger.error(f"DB Error get_channel_participants: {e}")
            return []

    def get_group_participants(self, group_id):
        try:
            query = "SELECT user_id FROM group_participants WHERE group_id = ?"
            rows = self._run(self._fetch(query, (group_id,)))
            return [row["user_id"] for row in rows]
        except Exception as e:
            logger.error(f"DB Error get_group_participants: {e}")
            return []

    def get_group_owner(self, group_id):
        try:
            row = self._run(
                self._fetchrow(
                    "SELECT owner_id FROM groups WHERE id = ?",
                    (group_id,),
                )
            )
            if row:
                return row["owner_id"]
            return None
        except Exception as e:
            logger.error(f"DB Error get_group_owner: {e}")
            return None

    def get_channel_history(self, channel_id, limit=50, offset=0):
        try:
            query = """
                SELECT * FROM messages
                WHERE channel_id = ?
                ORDER BY created_at DESC
                LIMIT ? OFFSET ?
            """
            rows = self._run(self._fetch(query, (channel_id, limit, offset)))

            messages = []
            for row in rows:
                msg = dict(row)
                if "created_at" in msg:
                    msg["timestamp"] = msg.pop("created_at")
                try:
                    msg["content"] = self._decrypt_payload(msg["content"])
                except Exception as e:
                    content_value = msg.get("content")
                    if (
                        isinstance(content_value, str)
                        and not content_value.startswith("mt:")
                        and not content_value.startswith("gAAAA")
                    ):
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
        except Exception as err:
            logger.error(f"Ошибка БД (история канала): {err}")
            return []

    def delete_messages_history(self, user_id, target_id):
        try:
            query = """
                DELETE FROM messages
                WHERE (sender_id = ? AND target_id = ?)
                   OR (sender_id = ? AND target_id = ?)
            """
            result = self._run(
                self._execute(
                    query,
                    (user_id, target_id, target_id, user_id),
                )
            )
            return int(result.split()[-1]) if isinstance(result, str) else 0
        except Exception as err:
            logger.error(f"Ошибка БД (удаление истории): {err}")
            return 0

    def delete_channel_history(self, channel_id):
        try:
            result = self._run(
                self._execute(
                    "DELETE FROM messages WHERE channel_id = ?",
                    (channel_id,),
                )
            )
            return int(result.split()[-1]) if isinstance(result, str) else 0
        except Exception as err:
            logger.error(f"Ошибка БД (удаление истории канала): {err}")
            return 0

    def delete_group_history(self, group_id):
        try:
            result = self._run(
                self._execute(
                    "DELETE FROM messages WHERE group_id = ?",
                    (group_id,),
                )
            )
            return int(result.split()[-1]) if isinstance(result, str) else 0
        except Exception as err:
            logger.error(f"Ошибка БД (удаление истории группы): {err}")
            return 0

    def get_group_history(self, group_id, limit=50, offset=0):
        try:
            query = """
                SELECT * FROM messages
                WHERE group_id = ?
                ORDER BY created_at DESC
                LIMIT ? OFFSET ?
            """
            rows = self._run(self._fetch(query, (group_id, limit, offset)))

            messages = []
            for row in rows:
                msg = dict(row)
                if "created_at" in msg:
                    msg["timestamp"] = msg.pop("created_at")
                try:
                    msg["content"] = self._decrypt_payload(msg["content"])
                except Exception as e:
                    content_value = msg.get("content")
                    if (
                        isinstance(content_value, str)
                        and not content_value.startswith("mt:")
                        and not content_value.startswith("gAAAA")
                    ):
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
        except Exception as err:
            logger.error(f"Ошибка БД (история группы): {err}")
            return []

    def get_online_users_count(self):
        try:
            row = self._run(
                self._fetchrow(
                    "SELECT COUNT(*) as count FROM users WHERE status = 'online'"
                )
            )
            return row["count"] if row else 0
        except Exception as e:
            logger.error(f"DB Error get_online_users_count: {e}")
            return 0

    def update_socket_id_for_user(self, user_id, socket_id):
        try:
            self._run(
                self._execute(
                    "UPDATE users SET socket_id = ?, status = 'online' WHERE id = ?",
                    (socket_id, user_id),
                )
            )
            row = self._run(
                self._fetchrow(
                    "SELECT * FROM users WHERE id = ?",
                    (user_id,),
                )
            )
            return dict(row) if row else None
        except Exception as e:
            logger.error(f"DB Error update_socket_id_for_user: {e}")
            return None

    def get_messages_history(self, user_id, target_id, limit=50, offset=0):
        try:
            query = """
                SELECT * FROM messages 
                WHERE (sender_id = ? AND target_id = ?) 
                   OR (sender_id = ? AND target_id = ?)
                ORDER BY created_at DESC
                LIMIT ? OFFSET ?
            """
            rows = self._run(
                self._fetch(
                    query,
                    (user_id, target_id, target_id, user_id, limit, offset),
                )
            )

            messages = []
            for row in rows:
                msg = dict(row)
                if "created_at" in msg:
                    msg["timestamp"] = msg.pop("created_at")
                try:
                    msg["content"] = self._decrypt_payload(msg["content"])
                except Exception as e:
                    content_value = msg.get("content")
                    if (
                        isinstance(content_value, str)
                        and not content_value.startswith("mt:")
                        and not content_value.startswith("gAAAA")
                    ):
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
        except Exception as err:
            logger.error(f"Ошибка БД (история сообщений): {err}")
            return []

    def search_users(self, query_str):
        try:
            query = "SELECT id, username, avatar_url, status FROM users WHERE username ILIKE ? LIMIT 20"
            rows = self._run(self._fetch(query, (f"%{query_str}%",)))
            return [dict(row) for row in rows]
        except Exception as e:
            logger.error(f"DB Error search_users: {e}")
            return []

    def search_messages(self, user_id, target_id, query_str):
        try:
            sql = """
                SELECT * FROM messages 
                WHERE (sender_id = ? AND target_id = ?) 
                   OR (sender_id = ? AND target_id = ?)
                ORDER BY created_at DESC
                LIMIT 500
            """
            rows = self._run(
                self._fetch(
                    sql,
                    (user_id, target_id, target_id, user_id),
                )
            )

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
        except Exception as e:
            logger.error(f"DB Error search_messages: {e}")
            return []
