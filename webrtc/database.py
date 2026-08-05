import base64
import hashlib
import json
import logging
import os
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timezone, timedelta

from cryptography.fernet import Fernet
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from sqlalchemy import Integer, String, Text, func, or_, select, delete, update, text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import Mapped, declarative_base, mapped_column
from werkzeug.security import check_password_hash

from webrtc.config import Config

logger = logging.getLogger(__name__)
Base = declarative_base()


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    username: Mapped[str | None] = mapped_column(String, nullable=True)
    avatar_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    access_token: Mapped[str | None] = mapped_column(Text, nullable=True)
    access_token_lookup: Mapped[str | None] = mapped_column(String, nullable=True)
    socket_id: Mapped[str | None] = mapped_column(String, nullable=True)
    status: Mapped[str | None] = mapped_column(String, nullable=True)
    last_seen: Mapped[datetime | None] = mapped_column(nullable=True)
    is_blocked: Mapped[int | None] = mapped_column(Integer, nullable=True)
    role: Mapped[str | None] = mapped_column(String, nullable=True)


class UserSession(Base):
    __tablename__ = "user_sessions"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    user_id: Mapped[str] = mapped_column(String, nullable=False, index=True)
    device_type: Mapped[str] = mapped_column(String, nullable=False)
    access_token_lookup: Mapped[str] = mapped_column(String, nullable=False, unique=True)
    access_token_hash: Mapped[str] = mapped_column(Text, nullable=False)
    refresh_token_lookup: Mapped[str] = mapped_column(String, nullable=False, unique=True)
    refresh_token_hash: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime | None] = mapped_column(nullable=True)
    last_active: Mapped[datetime | None] = mapped_column(nullable=True)
    expires_at: Mapped[datetime | None] = mapped_column(nullable=True)
    ip_address: Mapped[str | None] = mapped_column(Text, nullable=True)


class Device(Base):
    __tablename__ = "devices"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    user_id: Mapped[str] = mapped_column(String, nullable=False, index=True)
    token: Mapped[str] = mapped_column(Text, unique=True, nullable=False, index=True)
    platform: Mapped[str] = mapped_column(String, nullable=False, default="android")
    device_type: Mapped[str] = mapped_column(String, nullable=False, default="mobile")
    created_at: Mapped[datetime | None] = mapped_column(nullable=True)
    updated_at: Mapped[datetime | None] = mapped_column(nullable=True)


class OAuthAccessToken(Base):
    __tablename__ = "oauth_access_tokens"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    token: Mapped[str] = mapped_column(Text, nullable=False)
    client_id: Mapped[str] = mapped_column(String, nullable=False)
    user_id: Mapped[str] = mapped_column(String, nullable=False)
    expires_at: Mapped[datetime | None] = mapped_column(nullable=True)
    scope: Mapped[str | None] = mapped_column(Text, nullable=True)

    def is_expired(self):
        if not self.expires_at:
            return False
        return datetime.utcnow() > self.expires_at


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
    is_edited: Mapped[int | None] = mapped_column(Integer, nullable=True)
    forwarded_from_id: Mapped[str | None] = mapped_column(String, nullable=True)


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

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
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

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    channel_id: Mapped[str] = mapped_column(String, nullable=False)
    user_id: Mapped[str] = mapped_column(String, nullable=False)


class GroupParticipant(Base):
    __tablename__ = "group_participants"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    group_id: Mapped[str] = mapped_column(String, nullable=False)
    user_id: Mapped[str] = mapped_column(String, nullable=False)


class ChatClear(Base):
    __tablename__ = "chat_clears"

    user_id: Mapped[str] = mapped_column(String, primary_key=True)
    peer_id: Mapped[str] = mapped_column(String, primary_key=True)
    chat_type: Mapped[str] = mapped_column(String, primary_key=True)
    cleared_at: Mapped[datetime] = mapped_column(nullable=False)


class PendingCall(Base):
    __tablename__ = "pending_calls"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    caller_id: Mapped[str] = mapped_column(String, nullable=False, index=True)
    target_id: Mapped[str] = mapped_column(String, nullable=False, index=True)
    caller_username: Mapped[str | None] = mapped_column(String, nullable=True)
    caller_avatar_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    offer_sdp: Mapped[str] = mapped_column(Text, nullable=False)
    offer_type: Mapped[str] = mapped_column(String, nullable=False, default="offer")
    created_at: Mapped[datetime] = mapped_column(nullable=False, default=datetime.utcnow)
    answered: Mapped[bool] = mapped_column(nullable=False, default=False)


import urllib.parse

def _get_async_db_url(raw_url: str) -> str:
    url = raw_url
    if url.startswith("postgresql://"):
        url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
    elif url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql+asyncpg://", 1)
    elif url.startswith("sqlite://"):
        url = url.replace("sqlite://", "sqlite+aiosqlite://", 1)

    if "sslmode=" in url:
        parsed = urllib.parse.urlparse(url)
        query_params = urllib.parse.parse_qs(parsed.query)
        query_params.pop("sslmode", None)
        new_query = urllib.parse.urlencode(query_params, doseq=True)
        url = urllib.parse.urlunparse(parsed._replace(query=new_query))

    return url


class UserRepository:
    def __init__(self):
        try:
            if not Config.DATABASE_URL:
                raise RuntimeError("DATABASE_URL is not configured")
            self.cipher = Fernet(Config.MESSAGE_ENCRYPTION_KEY)
            self.mt_key, self.mt_iv = self._derive_mtproto_key_iv(
                Config.MESSAGE_ENCRYPTION_KEY
            )
            async_url = _get_async_db_url(Config.DATABASE_URL)
            self.engine = create_async_engine(async_url, pool_pre_ping=True)
            self.session_factory = async_sessionmaker(
                bind=self.engine, class_=AsyncSession, expire_on_commit=False
            )
        except Exception as e:
            logger.error(f"Ошибка инициализации репозитория: {e}")
            raise

    @asynccontextmanager
    async def _session(self):
        async with self.session_factory() as session:
            try:
                yield session
                await session.commit()
            except Exception:
                await session.rollback()
                raise

    async def _ensure_schema(self):
        try:
            async with self.engine.begin() as conn:
                await conn.execute(
                    text("ALTER TABLE messages ADD COLUMN IF NOT EXISTS reply_to_id TEXT"))
                await conn.execute(
                    text("ALTER TABLE messages ADD COLUMN IF NOT EXISTS forwarded_from_id TEXT"))
                await conn.execute(
                    text("ALTER TABLE users ADD COLUMN IF NOT EXISTS access_token_lookup TEXT"))
                await conn.execute(
                    text("ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_read INTEGER"))
                await conn.execute(
                    text("ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_deleted INTEGER"))
                await conn.execute(
                    text("ALTER TABLE messages ADD COLUMN IF NOT EXISTS pinned_by TEXT"))
                await conn.execute(
                    text("ALTER TABLE messages ADD COLUMN IF NOT EXISTS reactions TEXT"))
                await conn.execute(
                    text("ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_edited INTEGER"))
                await conn.execute(
                    text(
                        """
                        CREATE TABLE IF NOT EXISTS chat_clears (
                            user_id TEXT NOT NULL,
                            peer_id TEXT NOT NULL,
                            chat_type TEXT NOT NULL,
                            cleared_at TIMESTAMP NOT NULL,
                            PRIMARY KEY (user_id, peer_id, chat_type)
                        )
                        """
                    )
                )
                await conn.execute(
                    text(
                        """
                        CREATE TABLE IF NOT EXISTS user_conversations (
                            id TEXT PRIMARY KEY,
                            user_id TEXT NOT NULL,
                            partner_id TEXT NOT NULL,
                            is_secret BOOLEAN NOT NULL DEFAULT 0,
                            created_at TIMESTAMP,
                            updated_at TIMESTAMP,
                            CONSTRAINT uq_user_conversation UNIQUE (user_id, partner_id)
                        )
                        """
                    )
                )
                await conn.execute(
                    text(
                        "ALTER TABLE user_conversations "
                        "ADD COLUMN IF NOT EXISTS is_secret BOOLEAN NOT NULL DEFAULT 0"))
                await conn.execute(
                    text(
                        """
                        CREATE TABLE IF NOT EXISTS devices (
                            id TEXT PRIMARY KEY,
                            user_id TEXT NOT NULL,
                            token TEXT UNIQUE NOT NULL,
                            platform TEXT NOT NULL DEFAULT 'android',
                            device_type TEXT NOT NULL DEFAULT 'mobile',
                            created_at TIMESTAMP,
                            updated_at TIMESTAMP
                        )
                        """
                    )
                )
        except Exception as e:
            logger.warning(f"Schema ensure skipped/failed: {e}")

    async def _set_chat_cleared(self, user_id, peer_id, chat_type):
        now = datetime.utcnow()
        async with self._session() as session:
            result = await session.execute(
                select(ChatClear).where(
                    ChatClear.user_id == str(user_id),
                    ChatClear.peer_id == str(peer_id),
                    ChatClear.chat_type == str(chat_type),
                )
            )
            row = result.scalars().first()
            if row:
                row.cleared_at = now
            else:
                session.add(
                    ChatClear(
                        user_id=str(user_id),
                        peer_id=str(peer_id),
                        chat_type=str(chat_type),
                        cleared_at=now,
                    )
                )

    async def _get_chat_cleared_at(self, user_id, peer_id, chat_type):
        try:
            async with self._session() as session:
                result = await session.execute(
                    select(ChatClear).where(
                        ChatClear.user_id == str(user_id),
                        ChatClear.peer_id == str(peer_id),
                        ChatClear.chat_type == str(chat_type),
                    )
                )
                row = result.scalars().first()
                return row.cleared_at if row else None
        except Exception as err:
            logger.error(f"Ошибка БД (chat clear): {err}")
            return None

    async def _clear_chat_clear_records(self, peer_id, chat_type):
        async with self._session() as session:
            await session.execute(
                delete(ChatClear).where(
                    ChatClear.peer_id == str(peer_id),
                    ChatClear.chat_type == str(chat_type),
                )
            )

    async def save_pending_call(self, caller_id, target_id, caller_username, caller_avatar_url, offer_sdp, offer_type="offer"):
        async with self._session() as session:
            await session.execute(
                delete(PendingCall).where(
                    PendingCall.created_at < datetime.utcnow() - timedelta(minutes=5)
                )
            )
            await session.execute(
                delete(PendingCall).where(
                    PendingCall.caller_id == str(caller_id),
                    PendingCall.target_id == str(target_id),
                )
            )
            pc = PendingCall(
                caller_id=str(caller_id),
                target_id=str(target_id),
                caller_username=caller_username,
                caller_avatar_url=caller_avatar_url,
                offer_sdp=offer_sdp,
                offer_type=offer_type,
            )
            session.add(pc)
            await session.flush()
            return pc.id

    async def get_pending_calls(self, user_id):
        async with self._session() as session:
            result = await session.execute(
                select(PendingCall).where(
                    PendingCall.target_id == str(user_id),
                    PendingCall.answered == False
                )
            )
            calls = result.scalars().all()
            return [
                {
                    "id": c.id,
                    "caller_id": c.caller_id,
                    "caller_username": c.caller_username,
                    "caller_avatar_url": c.caller_avatar_url,
                    "offer_sdp": c.offer_sdp,
                    "offer_type": c.offer_type,
                    "created_at": c.created_at.isoformat() if c.created_at else None,
                }
                for c in calls
            ]

    async def mark_pending_call_answered(self, call_id):
        async with self._session() as session:
            await session.execute(
                update(PendingCall).where(PendingCall.id == str(call_id)).values(answered=True)
            )

    async def delete_pending_call(self, call_id):
        async with self._session() as session:
            await session.execute(
                delete(PendingCall).where(PendingCall.id == str(call_id))
            )

    @staticmethod
    def _model_to_dict(model):
        return {column.name: getattr(model, column.name)
                for column in model.__table__.columns}

    async def _resolve_forwarded_from(self, msg: dict) -> dict:
        fwd_id = msg.get("forwarded_from_id")
        if not fwd_id:
            return msg
        try:
            async with self._session() as session:
                result = await session.execute(select(User).where(User.id == str(fwd_id)))
                sender = result.scalars().first()
                msg["forwarded_from"] = {
                    "sender_id": fwd_id,
                    "sender_name": sender.username if sender else "Пользователь",
                    "sender_avatar": sender.avatar_url if sender else None,
                }
        except Exception as e:
            logger.error(f"Error resolving forwarded_from: {e}")
        return msg

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

    @staticmethod
    def _hash_token(token):
        if not token:
            return None
        return hashlib.sha256(str(token).encode("utf-8")).hexdigest()

    async def fetch_user_by_token(self, token):
        try:
            token = (token or "").strip()
            if not token:
                return None
            token_hash = self._hash_token(token)
            async with self._session() as session:
                row = None
                if "." in token:
                    lookup, _, sec = token.partition(".")
                    if lookup and sec and "." not in sec:
                        try:
                            res = await session.execute(
                                select(UserSession).where(UserSession.access_token_lookup == lookup)
                            )
                            sess = res.scalars().first()
                            if (
                                sess
                                and sess.access_token_hash
                                and check_password_hash(sess.access_token_hash, token)
                            ):
                                now = datetime.now(timezone.utc)
                                sess_exp = sess.expires_at
                                is_expired = False
                                if sess_exp:
                                    if sess_exp.tzinfo is None:
                                        sess_exp = sess_exp.replace(tzinfo=timezone.utc)
                                    if sess_exp < now:
                                        is_expired = True

                                if is_expired:
                                    await session.delete(sess)
                                else:
                                    sess.last_active = datetime.now(timezone.utc)
                                    res_user = await session.execute(
                                        select(User).where(User.id == sess.user_id)
                                    )
                                    row = res_user.scalars().first()
                        except Exception as ex:
                            logger.warning(f"UserSession lookup check error: {ex}")
                if not row and "." in token:
                    lookup, _, sec = token.partition(".")
                    if lookup and sec and "." not in sec:
                        res = await session.execute(
                            select(User).where(User.access_token_lookup == lookup)
                        )
                        cand = res.scalars().first()
                        if (
                            cand
                            and cand.access_token
                            and check_password_hash(cand.access_token, token)
                        ):
                            row = cand
                if not row and token_hash:
                    res = await session.execute(
                        select(User).where(User.access_token == token_hash)
                    )
                    row = res.scalars().first()

                if not row and token:
                    res = await session.execute(
                        select(User).where(User.access_token == str(token))
                    )
                    legacy = res.scalars().first()
                    if legacy and token_hash:
                        legacy.access_token = token_hash
                        row = legacy

                if not row and token:
                    res_oauth = await session.execute(
                        select(OAuthAccessToken).where(OAuthAccessToken.token == str(token))
                    )
                    oauth_token = res_oauth.scalars().first()
                    if oauth_token and not oauth_token.is_expired():
                        res_user = await session.execute(
                            select(User).where(User.id == oauth_token.user_id)
                        )
                        row = res_user.scalars().first()

                return self._model_to_dict(row) if row else None
        except Exception as e:
            logger.error(f"DB Error fetch_user_by_token: {e}")
            return None

    async def bind_socket(self, user_id, socket_id):
        try:
            async with self._session() as session:
                res = await session.execute(select(User).where(User.id == str(user_id)))
                user = res.scalars().first()
                if user:
                    user.socket_id = socket_id
                    user.status = "online"
                    user.last_seen = datetime.utcnow()
        except Exception as e:
            logger.error(f"DB Error bind_socket: {e}")

    async def release_socket(self, socket_id):
        try:
            async with self._session() as session:
                res = await session.execute(select(User).where(User.socket_id == socket_id))
                user = res.scalars().first()
                if not user:
                    return None
                user.socket_id = None
                user.status = "offline"
                user.last_seen = datetime.utcnow()
                return user.id
        except Exception as e:
            logger.error(f"DB Error release_socket: {e}")
            return None

    async def force_user_offline(self, user_id):
        try:
            async with self._session() as session:
                res = await session.execute(select(User).where(User.id == str(user_id)))
                user = res.scalars().first()
                if not user:
                    return False
                user.socket_id = None
                user.status = "offline"
                user.last_seen = datetime.utcnow()
                return True
        except Exception as e:
            logger.error(f"DB Error force_user_offline: {e}")
            return False

    async def get_user_friends_sockets(self, user_id):
        try:
            async with self._session() as session:
                res_req = await session.execute(
                    select(Friendship.requester_id).where(
                        Friendship.addressee_id == str(user_id),
                        Friendship.status == "accepted",
                    )
                )
                res_addr = await session.execute(
                    select(Friendship.addressee_id).where(
                        Friendship.requester_id == str(user_id),
                        Friendship.status == "accepted",
                    )
                )
                friend_ids = {row[0] for row in res_req.all()} | {row[0] for row in res_addr.all()}
                if not friend_ids:
                    return []
                res_sock = await session.execute(
                    select(User.socket_id).where(
                        User.id.in_(friend_ids),
                        User.socket_id.isnot(None),
                    )
                )
                return [row[0] for row in res_sock.all() if row[0]]
        except Exception as e:
            logger.error(f"DB Error get_user_friends_sockets: {e}")
            return []

    async def get_recent_dm_partner_sockets(self, user_id, limit_messages=500):
        uid = str(user_id)
        try:
            async with self._session() as session:
                res = await session.execute(
                    select(Message).where(
                        Message.channel_id.is_(None),
                        Message.group_id.is_(None),
                        Message.target_id.isnot(None),
                        or_(Message.sender_id == uid, Message.target_id == uid),
                    ).order_by(Message.created_at.desc(), Message.id.desc()).limit(limit_messages)
                )
                partner_ids: set[str] = set()
                for m in res.scalars().all():
                    if str(m.sender_id) == uid and m.target_id:
                        partner_ids.add(str(m.target_id))
                    elif m.target_id and str(m.target_id) == uid:
                        partner_ids.add(str(m.sender_id))
                if not partner_ids:
                    return []
                res_sock = await session.execute(
                    select(User.socket_id).where(
                        User.id.in_(partner_ids),
                        User.socket_id.isnot(None),
                    )
                )
                return [r[0] for r in res_sock.all() if r[0]]
        except Exception as e:
            logger.error(f"DB Error get_recent_dm_partner_sockets: {e}")
            return []

    async def find_user_by_socket(self, socket_id):
        try:
            async with self._session() as session:
                res = await session.execute(select(User).where(User.socket_id == socket_id))
                row = res.scalars().first()
                return self._model_to_dict(row) if row else None
        except Exception as e:
            logger.error(f"DB Error find_user_by_socket: {e}")
            return None

    async def get_socket_by_user_id(self, user_id):
        try:
            async with self._session() as session:
                res = await session.execute(select(User).where(User.id == str(user_id)))
                row = res.scalars().first()
                if row and row.socket_id:
                    return row.socket_id
            return None
        except Exception as e:
            logger.error(f"DB Error get_socket_by_user_id: {e}")
            return None

    async def save_message(self, msg_data):
        try:
            encrypted_content = self._encrypt_payload(msg_data["content"])
            encrypted_attachments = None
            if msg_data.get("attachments") is not None:
                if isinstance(msg_data["attachments"], str) and msg_data["attachments"].startswith("e2e:"):
                    encrypted_attachments = json.dumps(msg_data["attachments"])
                else:
                    attachments_json = json.dumps(msg_data["attachments"], ensure_ascii=False)
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

            async with self._session() as session:
                message = Message(
                    id=msg_data["id"],
                    sender_id=str(msg_data["sender_id"]),
                    target_id=str(msg_data.get("target_id")) if msg_data.get("target_id") else None,
                    channel_id=str(channel_id) if channel_id else None,
                    group_id=str(group_id) if group_id else None,
                    reply_to_id=str(reply_to) if reply_to else None,
                    forwarded_from_id=str(msg_data.get("forwarded_from_id")) if msg_data.get("forwarded_from_id") else None,
                    content=encrypted_content,
                    attachments=encrypted_attachments,
                    type=msg_type,
                    created_at=ts,
                    updated_at=ts,
                    is_read=0,
                )
                session.add(message)
            target_id = msg_data.get("target_id")
            if target_id and not channel_id and not group_id:
                await self._ensure_dm_conversation(msg_data["sender_id"], target_id)
            return True, None
        except Exception as e:
            logger.error(f"DB Error save_message: {e}")
            return False, str(e)

    async def save_video(self, video_data):
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
            async with self._session() as session:
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

    async def update_video(self, video_id, updates):
        try:
            async with self._session() as session:
                res = await session.execute(select(Video).where(Video.id == str(video_id)))
                video = res.scalars().first()
                if not video:
                    return False
                for key, value in updates.items():
                    if not hasattr(video, key):
                        continue
                    if key == "tags":
                        value = json.dumps(value, ensure_ascii=False) if value is not None else None
                    setattr(video, key, value)
                video.updated_at = datetime.now()
                return True
        except Exception as e:
            logger.error(f"DB Error update_video: {e}")
            return False

    async def delete_video(self, video_id):
        try:
            async with self._session() as session:
                res = await session.execute(select(Video).where(Video.id == str(video_id)))
                video = res.scalars().first()
                if not video:
                    return False
                video.is_deleted = 1
                video.updated_at = datetime.now()
                return True
        except Exception as e:
            logger.error(f"DB Error delete_video: {e}")
            return False

    async def get_video_by_id(self, video_id):
        try:
            async with self._session() as session:
                res = await session.execute(select(Video).where(Video.id == str(video_id)))
                row = res.scalars().first()
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

    async def list_videos(self, limit=20, offset=0, author_id=None):
        try:
            async with self._session() as session:
                stmt = select(Video).where(or_(Video.is_deleted == 0, Video.is_deleted.is_(None)))
                if author_id:
                    stmt = stmt.where(Video.author_id == str(author_id))
                stmt = stmt.order_by(Video.created_at.desc()).limit(limit).offset(offset)
                res = await session.execute(stmt)
                rows = res.scalars().all()
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

    async def mark_messages_as_read(self, message_ids, reader_id):
        try:
            if not message_ids:
                return
            async with self._session() as session:
                await session.execute(
                    update(Message).where(
                        Message.id.in_([str(mid) for mid in message_ids]),
                        Message.target_id == str(reader_id),
                    ).values(is_read=1)
                )
        except Exception as e:
            logger.error(f"DB Error mark_messages_as_read: {e}")

    async def get_message_meta(self, message_id):
        try:
            async with self._session() as session:
                res = await session.execute(select(Message).where(Message.id == str(message_id)))
                row = res.scalars().first()
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

    async def mark_message_deleted(self, message_id, sender_id):
        try:
            async with self._session() as session:
                res = await session.execute(select(Message).where(Message.id == str(message_id)))
                row = res.scalars().first()
                if not row:
                    return False, "not_found"
                if str(row.sender_id) != str(sender_id):
                    return False, "forbidden"
                await session.delete(row)
            return True, "ok"
        except Exception as e:
            logger.error(f"DB Error mark_message_deleted: {e}")
            return False, "db_error"

    async def get_channel_owner(self, channel_id):
        try:
            async with self._session() as session:
                res = await session.execute(select(Channel).where(Channel.id == str(channel_id)))
                row = res.scalars().first()
                if row:
                    return row.owner_id
            return None
        except Exception as e:
            logger.error(f"DB Error get_channel_owner: {e}")
            return None

    async def get_channel_participants(self, channel_id):
        try:
            async with self._session() as session:
                res = await session.execute(
                    select(ChannelParticipant.user_id).where(ChannelParticipant.channel_id == str(channel_id))
                )
                return [row[0] for row in res.all()]
        except Exception as e:
            logger.error(f"DB Error get_channel_participants: {e}")
            return []

    async def get_group_participants(self, group_id):
        try:
            async with self._session() as session:
                res = await session.execute(
                    select(GroupParticipant.user_id).where(GroupParticipant.group_id == str(group_id))
                )
                return [row[0] for row in res.all()]
        except Exception as e:
            logger.error(f"DB Error get_group_participants: {e}")
            return []

    async def get_group_owner(self, group_id):
        try:
            async with self._session() as session:
                res = await session.execute(select(Group).where(Group.id == str(group_id)))
                row = res.scalars().first()
                if row:
                    return row.owner_id
            return None
        except Exception as e:
            logger.error(f"DB Error get_group_owner: {e}")
            return None

    async def get_channel_history(self, channel_id, limit=50, offset=0, viewer_id=None):
        try:
            cleared_at = None
            if viewer_id:
                cleared_at = await self._get_chat_cleared_at(viewer_id, channel_id, "channel")
            async with self._session() as session:
                stmt = select(Message).where(Message.channel_id == str(channel_id))
                if cleared_at is not None:
                    stmt = stmt.where(Message.created_at > cleared_at)
                stmt = stmt.order_by(Message.created_at.desc()).limit(limit).offset(offset)
                res = await session.execute(stmt)
                rows = res.scalars().all()

            messages = []
            for row in rows:
                msg = self._model_to_dict(row)
                if "created_at" in msg:
                    ca = msg.pop("created_at")
                    msg["timestamp"] = ca.isoformat() + "Z" if ca and not ca.tzinfo else (ca.isoformat() if ca else None)
                try:
                    msg["content"] = self._decrypt_payload(msg["content"])
                except Exception as e:
                    content_value = msg.get("content")
                    if isinstance(content_value, str) and not content_value.startswith("mt:") and not content_value.startswith("gAAAA"):
                        msg["content"] = content_value
                    else:
                        msg["content"] = "[Не удалось расшифровать]"
                        logger.error(f"Ошибка дешифровки сообщения {msg['id']}: {e}")

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
                                msg["attachments"] = json.loads(msg["attachments"])
                            except Exception:
                                pass
                messages.append(msg)
            return messages
        except Exception as err:
            logger.error(f"Ошибка БД (история канала): {err}")
            return []

    async def _ensure_dm_conversation(self, user_id, partner_id):
        uid = str(user_id)
        pid = str(partner_id)
        if not uid or not pid or uid == pid:
            return
        try:
            async with self.engine.begin() as conn:
                for a, b in ((uid, pid), (pid, uid)):
                    await conn.execute(
                        text(
                            """
                            INSERT INTO user_conversations (id, user_id, partner_id)
                            SELECT :id, :user_id, :partner_id
                            WHERE NOT EXISTS (
                                SELECT 1 FROM user_conversations
                                WHERE user_id = :user_id AND partner_id = :partner_id
                            )
                            """
                        ),
                        {
                            "id": str(uuid.uuid4()),
                            "user_id": a,
                            "partner_id": b,
                        },
                    )
        except Exception as err:
            logger.warning(f"ensure_dm_conversation skipped: {err}")

    async def delete_messages_history(self, user_id, target_id, scope="for_all"):
        try:
            if scope == "for_me":
                await self._set_chat_cleared(user_id, target_id, "dm")
                await self._ensure_dm_conversation(user_id, target_id)
                return 0
            async with self._session() as session:
                res = await session.execute(
                    delete(Message).where(
                        or_(
                            (Message.sender_id == str(user_id)) & (Message.target_id == str(target_id)),
                            (Message.sender_id == str(target_id)) & (Message.target_id == str(user_id)),
                        )
                    )
                )
                deleted = res.rowcount
            await self._ensure_dm_conversation(user_id, target_id)
            return deleted or 0
        except Exception as err:
            logger.error(f"Ошибка БД (удаление истории): {err}")
            return 0

    async def delete_channel_history(self, channel_id, user_id=None, scope="for_all"):
        try:
            if scope == "for_me" and user_id:
                await self._set_chat_cleared(user_id, channel_id, "channel")
                return 0
            async with self._session() as session:
                res = await session.execute(
                    delete(Message).where(Message.channel_id == str(channel_id))
                )
                deleted = res.rowcount
            await self._clear_chat_clear_records(channel_id, "channel")
            return deleted or 0
        except Exception as err:
            logger.error(f"Ошибка БД (удаление истории канала): {err}")
            return 0

    async def delete_group_history(self, group_id, user_id=None, scope="for_all"):
        try:
            if scope == "for_me" and user_id:
                await self._set_chat_cleared(user_id, group_id, "group")
                return 0
            async with self._session() as session:
                res = await session.execute(
                    delete(Message).where(Message.group_id == str(group_id))
                )
                deleted = res.rowcount
            await self._clear_chat_clear_records(group_id, "group")
            return deleted or 0
        except Exception as err:
            logger.error(f"Ошибка БД (удаление истории группы): {err}")
            return 0

    async def get_group_history(self, group_id, limit=50, offset=0, viewer_id=None):
        try:
            cleared_at = None
            if viewer_id:
                cleared_at = await self._get_chat_cleared_at(viewer_id, group_id, "group")
            async with self._session() as session:
                stmt = select(Message).where(Message.group_id == str(group_id))
                if cleared_at is not None:
                    stmt = stmt.where(Message.created_at > cleared_at)
                stmt = stmt.order_by(Message.created_at.desc()).limit(limit).offset(offset)
                res = await session.execute(stmt)
                rows = res.scalars().all()

            messages = []
            for row in rows:
                msg = self._model_to_dict(row)
                if "created_at" in msg:
                    ca = msg.pop("created_at")
                    msg["timestamp"] = ca.isoformat() + "Z" if ca and not ca.tzinfo else (ca.isoformat() if ca else None)
                try:
                    msg["content"] = self._decrypt_payload(msg["content"])
                except Exception as e:
                    content_value = msg.get("content")
                    if isinstance(content_value, str) and not content_value.startswith("mt:") and not content_value.startswith("gAAAA"):
                        msg["content"] = content_value
                    else:
                        msg["content"] = "[Не удалось расшифровать]"
                        logger.error(f"Ошибка дешифровки сообщения {msg['id']}: {e}")

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
                                msg["attachments"] = json.loads(attachments_value)
                            except Exception:
                                msg["attachments"] = None
                        else:
                            msg["attachments"] = None
                        logger.error(f"Ошибка дешифровки вложений {msg['id']}: {e}")
                msg = await self._resolve_forwarded_from(msg)
                messages.append(msg)
            return messages
        except Exception as err:
            logger.error(f"Ошибка БД (история группы): {err}")
            return []

    async def get_online_users_count(self):
        try:
            async with self._session() as session:
                res = await session.execute(
                    select(func.count(User.id)).where(func.lower(func.coalesce(User.status, "")) == "online")
                )
                return res.scalar() or 0
        except Exception as e:
            logger.error(f"DB Error get_online_users_count: {e}")
            return 0

    async def get_online_user_ids(self):
        try:
            async with self._session() as session:
                res = await session.execute(
                    select(User.id).where(User.socket_id.isnot(None), User.socket_id != "")
                )
                return [str(row[0]) for row in res.all() if row and row[0]]
        except Exception as e:
            logger.error(f"DB Error get_online_user_ids: {e}")
            return []

    async def update_socket_id_for_user(self, user_id, socket_id):
        try:
            async with self._session() as session:
                res = await session.execute(select(User).where(User.id == str(user_id)))
                row = res.scalars().first()
                if not row:
                    return None
                row.socket_id = socket_id
                row.status = "online"
                return self._model_to_dict(row)
        except Exception as e:
            logger.error(f"DB Error update_socket_id_for_user: {e}")
            return None

    async def get_messages_history(self, user_id, target_id, limit=50, offset=0):
        try:
            cleared_at = await self._get_chat_cleared_at(user_id, target_id, "dm")
            async with self._session() as session:
                stmt = select(Message).where(
                    or_(
                        (Message.sender_id == str(user_id)) & (Message.target_id == str(target_id)),
                        (Message.sender_id == str(target_id)) & (Message.target_id == str(user_id)),
                    )
                )
                if cleared_at is not None:
                    stmt = stmt.where(Message.created_at > cleared_at)
                stmt = stmt.order_by(Message.created_at.desc()).limit(limit).offset(offset)
                res = await session.execute(stmt)
                rows = res.scalars().all()

            messages = []
            for row in rows:
                msg = self._model_to_dict(row)
                if "created_at" in msg:
                    ca = msg.pop("created_at")
                    msg["timestamp"] = ca.isoformat() + "Z" if ca and not ca.tzinfo else (ca.isoformat() if ca else None)
                try:
                    msg["content"] = self._decrypt_payload(msg["content"])
                except Exception as e:
                    content_value = msg.get("content")
                    if isinstance(content_value, str) and not content_value.startswith("mt:") and not content_value.startswith("gAAAA"):
                        msg["content"] = content_value
                    else:
                        msg["content"] = "[Не удалось расшифровать]"
                        logger.error(f"Ошибка дешифровки сообщения {msg['id']}: {e}")

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
                                msg["attachments"] = json.loads(attachments_value)
                            except Exception:
                                msg["attachments"] = None
                        else:
                            msg["attachments"] = None
                        logger.error(f"Ошибка дешифровки вложений {msg['id']}: {e}")
                msg = await self._resolve_forwarded_from(msg)
                messages.append(msg)
            return messages
        except Exception as err:
            logger.error(f"Ошибка БД (история сообщений): {err}")
            return []

    async def search_users(self, query_str):
        try:
            async with self._session() as session:
                res = await session.execute(
                    select(User).where(User.username.ilike(f"%{query_str}%")).limit(20)
                )
                rows = res.scalars().all()
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

    async def search_messages(self, user_id, target_id, query_str):
        try:
            async with self._session() as session:
                res = await session.execute(
                    select(Message).where(
                        or_(
                            (Message.sender_id == str(user_id)) & (Message.target_id == str(target_id)),
                            (Message.sender_id == str(target_id)) & (Message.target_id == str(user_id)),
                        )
                    ).order_by(Message.created_at.desc()).limit(500)
                )
                rows = res.scalars().all()

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

    async def get_pinned_message_ids(self):
        try:
            async with self._session() as session:
                res = await session.execute(
                    select(Message.id).where(Message.pinned_by.isnot(None))
                )
                return [row[0] for row in res.all()]
        except Exception as e:
            logger.error(f"DB Error get_pinned_message_ids: {e}")
            return []

    async def get_reactions_by_message(self):
        try:
            async with self._session() as session:
                res = await session.execute(
                    select(Message.id, Message.reactions).where(Message.reactions.isnot(None))
                )
                return [{"id": row[0], "reactions": row[1]} for row in res.all()]
        except Exception as e:
            logger.error(f"DB Error get_reactions_by_message: {e}")
            return []

    async def update_message_reactions(self, message_id, reactions):
        try:
            async with self._session() as session:
                res = await session.execute(select(Message).where(Message.id == str(message_id)))
                row = res.scalars().first()
                if not row:
                    return False
                row.reactions = reactions
                row.updated_at = datetime.now()
                return True
        except Exception as e:
            logger.error(f"DB Error update_message_reactions: {e}")
            return False

    async def update_message_pinned_by(self, message_id, pinned_by):
        try:
            async with self._session() as session:
                res = await session.execute(select(Message).where(Message.id == str(message_id)))
                row = res.scalars().first()
                if not row:
                    return False
                row.pinned_by = pinned_by
                row.updated_at = datetime.now()
                return True
        except Exception as e:
            logger.error(f"DB Error update_message_pinned_by: {e}")
            return False

    async def edit_message(self, message_id, sender_id, new_content):
        try:
            async with self._session() as session:
                res = await session.execute(
                    select(Message).where(
                        Message.id == str(message_id),
                        Message.sender_id == str(sender_id),
                    )
                )
                row = res.scalars().first()
                if not row:
                    return False
                row.content = self._encrypt_payload(new_content)
                row.is_edited = 1
                row.updated_at = datetime.now()
                return True
        except Exception as e:
            logger.error(f"DB Error edit_message: {e}")
            return False
