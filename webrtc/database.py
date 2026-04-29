import base64
import hashlib
import json
import logging
import os
from contextlib import contextmanager
from datetime import datetime

from cryptography.fernet import Fernet
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from sqlalchemy import Integer, String, Text, create_engine, func, or_
from sqlalchemy import text
from sqlalchemy.orm import Mapped, Session, declarative_base, mapped_column, sessionmaker

from config import Config

logger = logging.getLogger(__name__)
Base = declarative_base()


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    username: Mapped[str | None] = mapped_column(String, nullable=True)
    avatar_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    access_token: Mapped[str | None] = mapped_column(Text, nullable=True)
    socket_id: Mapped[str | None] = mapped_column(String, nullable=True)
    status: Mapped[str | None] = mapped_column(String, nullable=True)
    is_blocked: Mapped[int | None] = mapped_column(Integer, nullable=True)
    role: Mapped[str | None] = mapped_column(String, nullable=True)


class Message(Base):
    __tablename__ = "messages"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    sender_id: Mapped[str] = mapped_column(String, nullable=False)
    target_id: Mapped[str | None] = mapped_column(String, nullable=True)
    channel_id: Mapped[str | None] = mapped_column(String, nullable=True)
    group_id: Mapped[str | None] = mapped_column(String, nullable=True)

    reply_to_id: Mapped[str | None] = mapped_column(String, nullable=True)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    attachments: Mapped[str | None] = mapped_column(Text, nullable=True)
    type: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime | None] = mapped_column(nullable=True)
    updated_at: Mapped[datetime | None] = mapped_column(nullable=True)
    is_read: Mapped[int | None] = mapped_column(Integer, nullable=True)
    is_deleted: Mapped[int | None] = mapped_column(Integer, nullable=True)
    pinned_by: Mapped[str | None] = mapped_column(String, nullable=True)
    reactions: Mapped[str | None] = mapped_column(Text, nullable=True)


class Video(Base):
    __tablename__ = "videos"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    author_id: Mapped[str] = mapped_column(String, nullable=False)
    title: Mapped[str] = mapped_column(Text, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    url: Mapped[str] = mapped_column(Text, nullable=False)
    poster: Mapped[str | None] = mapped_column(Text, nullable=True)
    duration: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime | None] = mapped_column(nullable=True)
    updated_at: Mapped[datetime | None] = mapped_column(nullable=True)
    views: Mapped[int | None] = mapped_column(Integer, nullable=True)
    likes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    is_deleted: Mapped[int | None] = mapped_column(Integer, nullable=True)
    tags: Mapped[str | None] = mapped_column(Text, nullable=True)


class Friendship(Base):
    __tablename__ = "friendships"

    id: Mapped[int] = mapped_column(
        Integer, primary_key=True, autoincrement=True)
    requester_id: Mapped[str] = mapped_column(String, nullable=False)
    addressee_id: Mapped[str] = mapped_column(String, nullable=False)
    status: Mapped[str] = mapped_column(String, nullable=False)


class Channel(Base):
    __tablename__ = "channels"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    owner_id: Mapped[str] = mapped_column(String, nullable=False)


class Group(Base):
    __tablename__ = "groups"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    owner_id: Mapped[str] = mapped_column(String, nullable=False)


class ChannelParticipant(Base):
    __tablename__ = "channel_participants"

    id: Mapped[int] = mapped_column(
        Integer, primary_key=True, autoincrement=True)
    channel_id: Mapped[str] = mapped_column(String, nullable=False)
    user_id: Mapped[str] = mapped_column(String, nullable=False)


class GroupParticipant(Base):
    __tablename__ = "group_participants"

    id: Mapped[int] = mapped_column(
        Integer, primary_key=True, autoincrement=True)
    group_id: Mapped[str] = mapped_column(String, nullable=False)
    user_id: Mapped[str] = mapped_column(String, nullable=False)


class UserRepository:
    def __init__(self):
        try:
            if not Config.DATABASE_URL:
                raise RuntimeError("DATABASE_URL is not configured")
            self.cipher = Fernet(Config.MESSAGE_ENCRYPTION_KEY)
            self.mt_key, self.mt_iv = self._derive_mtproto_key_iv(
                Config.MESSAGE_ENCRYPTION_KEY
            )
            self.engine = create_engine(
                Config.DATABASE_URL, pool_pre_ping=True)
            self._ensure_schema()
            self.session_factory = sessionmaker(
                bind=self.engine, expire_on_commit=False)
        except Exception as e:
            logger.error(f"Ошибка инициализации репозитория: {e}")
            raise

    def _ensure_schema(self):
        """
        Lightweight runtime migration for environments without Alembic.
        Keeps DB schema compatible with current message payload fields.
        """
        try:
            with self.engine.begin() as conn:
                conn.execute(
                    text("ALTER TABLE messages ADD COLUMN IF NOT EXISTS reply_to_id TEXT"))
                conn.execute(
                    text("ALTER TABLE messages ADD COLUMN IF NOT EXISTS forwarded_from_id TEXT"))

                conn.execute(
                    text("ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_read INTEGER"))
                conn.execute(
                    text("ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_deleted INTEGER"))
                conn.execute(
                    text("ALTER TABLE messages ADD COLUMN IF NOT EXISTS pinned_by TEXT"))
                conn.execute(
                    text("ALTER TABLE messages ADD COLUMN IF NOT EXISTS reactions TEXT"))
        except Exception as e:

            logger.warning(f"Schema ensure skipped/failed: {e}")

    @contextmanager
    def _session(self):
        session: Session = self.session_factory()
        try:
            yield session
            session.commit()
        except Exception:
            session.rollback()
            raise
        finally:
            session.close()

    @staticmethod
    def _model_to_dict(model):
        return {column.name: getattr(model, column.name)
                for column in model.__table__.columns}

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
            with self._session() as session:
                row = session.query(User).filter(
                    User.access_token == token).first()
                return self._model_to_dict(row) if row else None
        except Exception as e:
            logger.error(f"DB Error fetch_user_by_token: {e}")
            return None

    def bind_socket(self, user_id, socket_id):
        try:
            with self._session() as session:
                user = session.query(User).filter(
                    User.id == str(user_id)).first()
                if user:
                    user.socket_id = socket_id
                    user.status = "Online"
        except Exception as e:
            logger.error(f"DB Error bind_socket: {e}")

    def release_socket(self, socket_id):
        try:
            with self._session() as session:
                user = session.query(User).filter(
                    User.socket_id == socket_id).first()
                if not user:
                    return None
                user.socket_id = None
                user.status = "Offline"
                return user.id
        except Exception as e:
            logger.error(f"DB Error release_socket: {e}")
            return None

    def get_user_friends_sockets(self, user_id):
        try:
            with self._session() as session:
                requester_rows = (
                    session.query(Friendship.requester_id)
                    .filter(
                        Friendship.addressee_id == str(user_id),
                        Friendship.status == "accepted",
                    )
                    .all()
                )
                addressee_rows = (
                    session.query(Friendship.addressee_id)
                    .filter(
                        Friendship.requester_id == str(user_id),
                        Friendship.status == "accepted",
                    )
                    .all()
                )
                friend_ids = {
                    row[0] for row in requester_rows} | {
                    row[0] for row in addressee_rows}
                if not friend_ids:
                    return []
                sockets = (
                    session.query(
                        User.socket_id) .filter(
                        User.id.in_(friend_ids),
                        User.socket_id.isnot(None)) .all())
                return [row[0] for row in sockets if row[0]]
        except Exception as e:
            logger.error(f"DB Error get_user_friends_sockets: {e}")
            return []

    def find_user_by_socket(self, socket_id):
        try:
            with self._session() as session:
                row = session.query(User).filter(
                    User.socket_id == socket_id).first()
                return self._model_to_dict(row) if row else None
        except Exception as e:
            logger.error(f"DB Error find_user_by_socket: {e}")
            return None

    def get_socket_by_user_id(self, user_id):
        try:
            with self._session() as session:
                row = session.query(User).filter(
                    User.id == str(user_id)).first()
                if row and row.socket_id:
                    return row.socket_id
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

                    encrypted_attachments = json.dumps(msg_data["attachments"])
                else:
                    attachments_json = json.dumps(
                        msg_data["attachments"], ensure_ascii=False
                    )

                    encrypted_payload = self._encrypt_payload(attachments_json)
                    encrypted_attachments = json.dumps(encrypted_payload)

            channel_id = msg_data.get("channel_id")
            group_id = msg_data.get("group_id")

            reply_to = msg_data.get("reply_to") or msg_data.get("reply_to_id")
            msg_type = msg_data.get("type", "text")

            ts = msg_data.get("timestamp")
            if isinstance(ts, str):
                try:
                    ts = datetime.fromisoformat(ts)
                except ValueError:
                    ts = datetime.now()
            elif not isinstance(ts, datetime):
                ts = datetime.now()

            with self._session() as session:
                message = Message(
                    id=msg_data["id"],
                    sender_id=str(
                        msg_data["sender_id"]),
                    target_id=str(
                        msg_data.get("target_id")) if msg_data.get("target_id") else None,
                    channel_id=str(channel_id) if channel_id else None,
                    group_id=str(group_id) if group_id else None,
                    reply_to_id=str(reply_to) if reply_to else None,
                    content=encrypted_content,
                    attachments=encrypted_attachments,
                    type=msg_type,
                    created_at=ts,
                    updated_at=ts,
                    is_read=0,
                )
                session.add(message)
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

            tags_json = None
            if video_data.get("tags") is not None:
                tags_json = json.dumps(video_data["tags"], ensure_ascii=False)
            with self._session() as session:
                video = Video(
                    id=video_data["id"],
                    author_id=str(video_data["author_id"]),
                    title=video_data["title"],
                    description=video_data.get("description"),
                    url=video_data["url"],
                    poster=video_data.get("poster"),
                    duration=video_data.get("duration"),
                    created_at=created_at,
                    updated_at=updated_at,
                    views=video_data.get("views", 0),
                    likes=video_data.get("likes", 0),
                    is_deleted=video_data.get("is_deleted", 0),
                    tags=tags_json,
                )
                session.add(video)
            return True
        except Exception as e:
            logger.error(f"DB Error save_video: {e}")
            return False

    def update_video(self, video_id, updates):
        try:
            with self._session() as session:
                video = session.query(Video).filter(
                    Video.id == str(video_id)).first()
                if not video:
                    return False
                for key, value in updates.items():
                    if not hasattr(video, key):
                        continue
                    if key == "tags":
                        value = json.dumps(
                            value, ensure_ascii=False) if value is not None else None
                    setattr(video, key, value)
                video.updated_at = datetime.now()
                return True
        except Exception as e:
            logger.error(f"DB Error update_video: {e}")
            return False

    def delete_video(self, video_id):
        try:
            with self._session() as session:
                video = session.query(Video).filter(
                    Video.id == str(video_id)).first()
                if not video:
                    return False
                video.is_deleted = 1
                video.updated_at = datetime.now()
                return True
        except Exception as e:
            logger.error(f"DB Error delete_video: {e}")
            return False

    def get_video_by_id(self, video_id):
        try:
            with self._session() as session:
                row = session.query(Video).filter(
                    Video.id == str(video_id)).first()
            if not row:
                return None
            data = self._model_to_dict(row)
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
            with self._session() as session:
                query = session.query(Video).filter(
                    or_(Video.is_deleted == 0, Video.is_deleted.is_(None)))
                if author_id:
                    query = query.filter(Video.author_id == str(author_id))
                rows = (
                    query.order_by(Video.created_at.desc())
                    .limit(limit)
                    .offset(offset)
                    .all()
                )
            out = []
            for row in rows:
                item = self._model_to_dict(row)
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
            if not message_ids:
                return
            with self._session() as session:
                session.query(Message).filter(
                    Message.id.in_([str(mid) for mid in message_ids]),
                    Message.target_id == str(reader_id),
                ).update({"is_read": 1}, synchronize_session=False)
        except Exception as e:
            logger.error(f"DB Error mark_messages_as_read: {e}")

    def get_message_meta(self, message_id):
        try:
            with self._session() as session:
                row = session.query(Message).filter(
                    Message.id == str(message_id)).first()
                if not row:
                    return None
                return {
                    "id": row.id,
                    "sender_id": row.sender_id,
                    "target_id": row.target_id,
                    "channel_id": row.channel_id,
                    "group_id": row.group_id,
                    "is_deleted": row.is_deleted,
                    "pinned_by": row.pinned_by,
                    "reactions": row.reactions,
                }
        except Exception as e:
            logger.error(f"DB Error get_message_meta: {e}")
            return None

    def mark_message_deleted(self, message_id, sender_id):
        try:
            with self._session() as session:
                row = session.query(Message).filter(
                    Message.id == str(message_id)).first()
            if not row:
                return False, "not_found"
            if str(row.sender_id) != str(sender_id):
                return False, "forbidden"
            with self._session() as session:
                row = session.query(Message).filter(
                    Message.id == str(message_id)).first()
                if row:
                    session.delete(row)
            return True, "ok"
        except Exception as e:
            logger.error(f"DB Error mark_message_deleted: {e}")
            return False, "db_error"

    def get_channel_owner(self, channel_id):
        try:
            with self._session() as session:
                row = session.query(Channel).filter(
                    Channel.id == str(channel_id)).first()
                if row:
                    return row.owner_id
            return None
        except Exception as e:
            logger.error(f"DB Error get_channel_owner: {e}")
            return None

    def get_channel_participants(self, channel_id):
        try:
            with self._session() as session:
                rows = session.query(ChannelParticipant.user_id).filter(
                    ChannelParticipant.channel_id == str(channel_id)
                ).all()
                return [row[0] for row in rows]
        except Exception as e:
            logger.error(f"DB Error get_channel_participants: {e}")
            return []

    def get_group_participants(self, group_id):
        try:
            with self._session() as session:
                rows = session.query(GroupParticipant.user_id).filter(
                    GroupParticipant.group_id == str(group_id)
                ).all()
                return [row[0] for row in rows]
        except Exception as e:
            logger.error(f"DB Error get_group_participants: {e}")
            return []

    def get_group_owner(self, group_id):
        try:
            with self._session() as session:
                row = session.query(Group).filter(
                    Group.id == str(group_id)).first()
                if row:
                    return row.owner_id
            return None
        except Exception as e:
            logger.error(f"DB Error get_group_owner: {e}")
            return None

    def get_channel_history(self, channel_id, limit=50, offset=0):
        try:
            with self._session() as session:
                rows = (
                    session.query(Message)
                    .filter(Message.channel_id == str(channel_id))
                    .order_by(Message.created_at.desc())
                    .limit(limit)
                    .offset(offset)
                    .all()
                )

            messages = []
            for row in rows:
                msg = self._model_to_dict(row)
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
                        if isinstance(
                                decrypted, str) and decrypted.startswith("e2e:"):
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
            with self._session() as session:
                deleted = (
                    session.query(Message) .filter(
                        or_(
                            (Message.sender_id == str(user_id)) & (
                                Message.target_id == str(target_id)), (Message.sender_id == str(target_id)) & (
                                Message.target_id == str(user_id)), )) .delete(
                        synchronize_session=False))
                return deleted or 0
        except Exception as err:
            logger.error(f"Ошибка БД (удаление истории): {err}")
            return 0

    def delete_channel_history(self, channel_id):
        try:
            with self._session() as session:
                deleted = (
                    session.query(Message)
                    .filter(Message.channel_id == str(channel_id))
                    .delete(synchronize_session=False)
                )
                return deleted or 0
        except Exception as err:
            logger.error(f"Ошибка БД (удаление истории канала): {err}")
            return 0

    def delete_group_history(self, group_id):
        try:
            with self._session() as session:
                deleted = (
                    session.query(Message)
                    .filter(Message.group_id == str(group_id))
                    .delete(synchronize_session=False)
                )
                return deleted or 0
        except Exception as err:
            logger.error(f"Ошибка БД (удаление истории группы): {err}")
            return 0

    def get_group_history(self, group_id, limit=50, offset=0):
        try:
            with self._session() as session:
                rows = (
                    session.query(Message)
                    .filter(Message.group_id == str(group_id))
                    .order_by(Message.created_at.desc())
                    .limit(limit)
                    .offset(offset)
                    .all()
                )

            messages = []
            for row in rows:
                msg = self._model_to_dict(row)
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
                        if isinstance(
                                decrypted, str) and decrypted.startswith("e2e:"):
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
            with self._session() as session:
                return session.query(func.count(User.id)).filter(
                    func.lower(func.coalesce(User.status, "")) == "online"
                ).scalar() or 0
        except Exception as e:
            logger.error(f"DB Error get_online_users_count: {e}")
            return 0

    def update_socket_id_for_user(self, user_id, socket_id):
        try:
            with self._session() as session:
                row = session.query(User).filter(
                    User.id == str(user_id)).first()
                if not row:
                    return None
                row.socket_id = socket_id
                row.status = "online"
                return self._model_to_dict(row)
        except Exception as e:
            logger.error(f"DB Error update_socket_id_for_user: {e}")
            return None

    def get_messages_history(self, user_id, target_id, limit=50, offset=0):
        try:
            with self._session() as session:
                rows = (
                    session.query(Message) .filter(
                        or_(
                            (Message.sender_id == str(user_id)) & (
                                Message.target_id == str(target_id)), (Message.sender_id == str(target_id)) & (
                                Message.target_id == str(user_id)), )) .order_by(
                        Message.created_at.desc()) .limit(limit) .offset(offset) .all())

            messages = []
            for row in rows:
                msg = self._model_to_dict(row)
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
                        if isinstance(
                                decrypted, str) and decrypted.startswith("e2e:"):
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
            with self._session() as session:
                rows = (
                    session.query(User)
                    .filter(User.username.ilike(f"%{query_str}%"))
                    .limit(20)
                    .all()
                )
                return [
                    {
                        "id": row.id,
                        "username": row.username,
                        "avatar_url": row.avatar_url,
                        "status": row.status,
                    }
                    for row in rows
                ]
        except Exception as e:
            logger.error(f"DB Error search_users: {e}")
            return []

    def search_messages(self, user_id, target_id, query_str):
        try:
            with self._session() as session:
                rows = (
                    session.query(Message) .filter(
                        or_(
                            (Message.sender_id == str(user_id)) & (
                                Message.target_id == str(target_id)), (Message.sender_id == str(target_id)) & (
                                Message.target_id == str(user_id)), )) .order_by(
                        Message.created_at.desc()) .limit(500) .all())

            results = []
            for row in rows:
                msg = self._model_to_dict(row)
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

    def get_pinned_message_ids(self):
        try:
            with self._session() as session:
                rows = (
                    session.query(Message.id)
                    .filter(Message.pinned_by.isnot(None))
                    .all()
                )
                return [row[0] for row in rows]
        except Exception as e:
            logger.error(f"DB Error get_pinned_message_ids: {e}")
            return []

    def get_reactions_by_message(self):
        try:
            with self._session() as session:
                rows = (
                    session.query(Message.id, Message.reactions)
                    .filter(Message.reactions.isnot(None))
                    .all()
                )
                return [{"id": row[0], "reactions": row[1]} for row in rows]
        except Exception as e:
            logger.error(f"DB Error get_reactions_by_message: {e}")
            return []

    def update_message_reactions(self, message_id, reactions):
        try:
            with self._session() as session:
                row = session.query(Message).filter(
                    Message.id == str(message_id)).first()
                if not row:
                    return False
                row.reactions = reactions
                row.updated_at = datetime.now()
                return True
        except Exception as e:
            logger.error(f"DB Error update_message_reactions: {e}")
            return False

    def update_message_pinned_by(self, message_id, pinned_by):
        try:
            with self._session() as session:
                row = session.query(Message).filter(
                    Message.id == str(message_id)).first()
                if not row:
                    return False
                row.pinned_by = pinned_by
                row.updated_at = datetime.now()
                return True
        except Exception as e:
            logger.error(f"DB Error update_message_pinned_by: {e}")
            return False
