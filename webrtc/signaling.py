import asyncio
import json
import logging
import os
import time
import uuid
from collections import defaultdict, deque
from datetime import datetime
import urllib.request

from socketio.exceptions import ConnectionRefusedError

from webrtc.config import Config
from webrtc.proxy import ConnectionBroker

logger = logging.getLogger(__name__)


class SignalingService:
    def __init__(
        self,
        socket_server,
        broker: ConnectionBroker,
        *,
        bind_disconnect: bool = True,
    ):
        self.io = socket_server
        self.broker = broker
        self._bind_disconnect = bind_disconnect
        self.group_calls = {}
        self.voice_channel_calls = {}
        self._connect_buckets = defaultdict(deque)
        self._connect_lock = asyncio.Lock()
        self._connect_limit = 20
        self._connect_window_seconds = 60
        self._message_reactions = defaultdict(lambda: defaultdict(set))
        self._pinned_messages = set()
        self._bind_events()

    async def load_existing_interactions(self):
        try:
            rows = await self.broker.repo.get_pinned_message_ids()
            for message_id in rows:
                self._pinned_messages.add(message_id)

            reaction_rows = await self.broker.repo.get_reactions_by_message()
            for row in reaction_rows:
                message_id = row["id"]
                reactions_str = row["reactions"]
                if reactions_str:
                    try:
                        reactions_dict = json.loads(reactions_str)
                        for emoji, user_list in reactions_dict.items():
                            if isinstance(user_list, list):
                                self._message_reactions[message_id][emoji] = set(user_list)
                    except BaseException:
                        pass
        except Exception as e:
            logger.error(f"Error loading existing interactions: {e}")

    async def _get_user_devices(self, user_id: str):
        try:
            from sqlalchemy import select
            from webrtc.database import Device
            async with self.broker.repo._session() as session:
                res = await session.execute(select(Device).where(Device.user_id == str(user_id)))
                devices = res.scalars().all()
                return [{"token": d.token, "platform": d.platform} for d in devices]
        except Exception as e:
            logger.error(f"Error fetching devices for {user_id}: {e}")
            return []

    async def _push_notify_user(self, user_id: str, title: str, body: str, data: dict | None = None):
        try:
            from webrtc.rabbitmq_publisher import publish_to_queue
            published = publish_to_queue("push_queue", {
                "type": "notification",
                "user_id": user_id,
                "title": title,
                "body": body,
                "data": data or {},
            })
            if published:
                return
        except Exception as pe:
            logger.warning(f"RabbitMQ push publish error: {pe}")

        try:
            from webrtc.fcm_push import send_push_notification
            devices = await self._get_user_devices(user_id)
            for dev in devices:
                await send_push_notification(dev["token"], title, body, data)
        except Exception as e:
            logger.error(f"Error sending push to {user_id}: {e}")
        try:
            await self._send_web_push(user_id, title, body, data)
        except Exception as e:
            logger.error(f"Web Push error for {user_id}: {e}")

    async def _send_web_push(self, user_id: str, title: str, body: str, data: dict | None = None):
        try:
            from sqlalchemy import text
            async with self.broker.repo._session() as session:
                res = await session.execute(
                    text("SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = :uid"),
                    {"uid": user_id}
                )
                rows = res.fetchall()

            logger.info(f"Web Push query: found {len(rows)} subscription(s) for user_id={user_id}")
            if not rows:
                return

            vapid_private = os.environ.get("VAPID_PRIVATE_KEY") or "ZgiAe9mf4fmMp_Suy_ZQjj0CZVys5zRsFex25DllvTo"
            vapid_public = os.environ.get("VAPID_PUBLIC_KEY") or "BIe-Z2GMAZp05xBkGysdmolFc7jczvXIQJcGDVfkWkyY-P1XJnJoTcyOzW00-z6AvlleA7wxFXa8B-f_RHI5pBk"
            vapid_claims = {"sub": "mailto:admin@vondic.ru"}

            payload = json.dumps({
                "title": title,
                "body": body,
                "data": data or {},
            }).encode("utf-8")

            for row in rows:
                endpoint, p256dh, auth = row[0], row[1], row[2]
                try:
                    status = self._web_push_send(endpoint, p256dh, auth, payload, vapid_private, vapid_public, vapid_claims)
                    logger.info(f"Web Push dispatched to {endpoint[:45]} -> status={status}")
                except Exception as e:
                    logger.warning(f"Web Push to {endpoint[:45]} failed: {e}")
                    try:
                        async with self.broker.repo._session() as session:
                            await session.execute(
                                text("DELETE FROM push_subscriptions WHERE endpoint = :ep"),
                                {"ep": endpoint}
                            )
                    except Exception:
                        pass
        except Exception as e:
            logger.error(f"Web Push batch error: {e}")

    @staticmethod
    def _web_push_send(endpoint: str, p256dh: str, auth_key: str, payload: bytes,
                        vapid_private: str, vapid_public: str, claims: dict):
        try:
            from pywebpush import webpush, WebPushException
            subscription_info = {
                "endpoint": endpoint,
                "keys": {
                    "p256dh": p256dh,
                    "auth": auth_key,
                }
            }
            data_str = payload.decode("utf-8") if isinstance(payload, bytes) else payload
            resp = webpush(
                subscription_info=subscription_info,
                data=data_str,
                vapid_private_key=vapid_private,
                vapid_claims=claims,
                headers={"Urgency": "high", "TTL": "86400"},
                timeout=10,
            )
            status = resp.status_code if hasattr(resp, "status_code") else 201
            logger.info(f"Web Push (pywebpush) status: {status} for {endpoint[:45]}")
            return status
        except Exception as pe:
            logger.error(f"pywebpush error for {endpoint[:45]}: {pe}")
            return None

    async def _push_call_user(self, user_id: str, call_data: dict):
        try:
            from webrtc.fcm_push import send_call_wake
            devices = await self._get_user_devices(user_id)
            for dev in devices:
                await send_call_wake(dev["token"], call_data)
        except Exception as e:
            logger.error(f"Error sending call push to {user_id}: {e}")
        try:
            caller_name = call_data.get("caller_name", "Пользователь")
            call_type = "Видеозвонок" if call_data.get("is_video") else "Голосовой звонок"
            await self._send_web_push(
                user_id,
                f"Входящий {call_type}",
                f"{caller_name} звонит вам...",
                {"type": "incoming_call", "call_id": call_data.get("call_id"), **call_data}
            )
        except Exception as e:
            logger.error(f"Web Push call wake error for {user_id}: {e}")

    def _get_push_body(self, content: str, msg_type: str) -> str:
        if msg_type == "image":
            return "отправил фото"
        if msg_type == "file":
            return "отправил файл"
        if msg_type == "audio":
            return "отправил голосовое сообщение"
        if content and content.startswith("e2e:"):
            return "отправил зашифрованное сообщение"
        if content and len(content) > 100:
            return "отправил сообщение: " + content[:100] + "..."
        return "отправил сообщение: " + (content or "Новое сообщение")

    async def _broadcast_status(self, user_id, status):
        try:
            sockets = set()
            friends_sids = await self.broker.repo.get_user_friends_sockets(user_id)
            for sid in friends_sids:
                if sid:
                    sockets.add(sid)
            dm_sids = await self.broker.repo.get_recent_dm_partner_sockets(user_id)
            for sid in dm_sids:
                if sid:
                    sockets.add(sid)
            payload = {"user_id": user_id, "status": status}
            if status.lower() == "offline":
                payload["last_seen"] = f"{datetime.utcnow().isoformat()}Z"
            for socket_id in sockets:
                await self.io.emit("user_status_changed", payload, room=socket_id)
        except Exception as e:
            logger.error(f"Error broadcasting status for {user_id}: {e}")

    def _bind_events(self):
        self.io.on("connect", self.on_connect)
        if self._bind_disconnect:
            self.io.on("disconnect", self.on_disconnect)
        self.io.on("logout", self.on_logout)
        self.io.on("ping_stability", self.on_ping)
        self.io.on("offer", self.on_offer)
        self.io.on("answer", self.on_answer)
        self.io.on("ice_candidate", self.on_ice)
        self.io.on("call_user", self.on_call_user)
        self.io.on("call_answer", self.on_call_answer)
        self.io.on("call_reject", self.on_call_reject)
        self.io.on("call_end", self.on_call_end)
        self.io.on("call_group", self.on_call_group)
        self.io.on("group_call_answer", self.on_group_call_answer)
        self.io.on("group_call_reject", self.on_group_call_reject)
        self.io.on("group_call_end", self.on_group_call_end)
        self.io.on("get_active_group_call", self.on_get_active_group_call)
        self.io.on("join_voice_channel", self.on_join_voice_channel)
        self.io.on("leave_voice_channel", self.on_leave_voice_channel)
        self.io.on("send_message", self.on_send_message)
        self.io.on("delete_message", self.on_delete_message)
        self.io.on("edit_message", self.on_edit_message)
        self.io.on("react_message", self.on_react_message)
        self.io.on("pin_message", self.on_pin_message)
        self.io.on("post_create", self.on_post_create)
        self.io.on("post_update", self.on_post_update)
        self.io.on("post_delete", self.on_post_delete)
        self.io.on("video_create", self.on_video_create)
        self.io.on("video_update", self.on_video_update)
        self.io.on("video_delete", self.on_video_delete)
        self.io.on("e2e_key_exchange", self.on_e2e_key_exchange)
        self.io.on("typing", self.on_typing)
        self.io.on("stop_typing", self.on_stop_typing)
        self.io.on("message_read", self.on_message_read)
        self.io.on("get_group_history", self.on_get_group_history)
        self.io.on("get_history", self.on_get_history)
        self.io.on("authenticate", self.on_authenticate)
        self.io.on("get_online_users", self.on_get_online_users)
        self.io.on("video_state_changed", self.on_video_state_changed)
        self.io.on("screen_share_state_changed", self.on_screen_share_state_changed)

    async def _allow_connect(self, environ):
        now = time.time()
        forwarded = environ.get("HTTP_X_FORWARDED_FOR", "")
        key = forwarded.split(",")[0].strip() if forwarded else (environ.get("REMOTE_ADDR") or "unknown")
        async with self._connect_lock:
            bucket = self._connect_buckets[key]
            cutoff = now - self._connect_window_seconds
            while bucket and bucket[0] <= cutoff:
                bucket.popleft()
            if len(bucket) >= self._connect_limit:
                return False
            bucket.append(now)
        return True

    async def _get_sender(self, sid):
        session = await self.io.get_session(sid)
        sender_id = session.get("user_id") if session else None
        sender = None
        if not sender_id:
            sender = await self.broker.resolve_recipient(sid)
            if sender:
                sender_id = sender.get("id")
        if not sender:
            sender = await self.broker.resolve_recipient(sid)
        return sender_id, sender

    async def on_connect(self, sid, environ, auth=None):
        if not await self._allow_connect(environ):
            logger.warning("Отклонено: превышен лимит подключений")
            raise ConnectionRefusedError("429 Too Many Requests: Превышен лимит подключений")
        token_value = None
        if auth and isinstance(auth, dict):
            token_value = auth.get("token")
        if not token_value:
            # Query string parsing from environ
            from urllib.parse import parse_qs
            qs = parse_qs(environ.get("QUERY_STRING", ""))
            token_list = qs.get("token")
            if token_list:
                token_value = token_list[0]
        if not token_value:
            logger.warning("Отклонено: Токен не предоставлен")
            raise ConnectionRefusedError("401 Unauthorized: Токен не предоставлен")
        user_info = await self.broker.register_session(token_value, sid)
        if not user_info:
            logger.warning("Отклонено: Ошибка регистрации сессии")
            raise ConnectionRefusedError("401 Unauthorized: Ошибка регистрации")

        await self.io.save_session(sid, {"user_id": user_info["id"]})
        await self._broadcast_status(user_info["id"], "online")
        await self.io.enter_room(sid, str(user_info["id"]))
        logger.info(f"Пользователь {user_info['username']} подключен. SID: {sid}")

        await self.io.emit(
            "connection_success",
            {
                "message": "Успешное подключение",
                "user_id": user_info["id"],
                "socket_id": sid,
                "role": user_info.get("role", "User"),
            },
            room=sid
        )

        try:
            pending = await self.broker.repo.get_pending_calls(user_info["id"])
            for call in pending:
                try:
                    offer = json.loads(call["offer_sdp"]) if call["offer_sdp"] else None
                except (json.JSONDecodeError, TypeError):
                    offer = None
                incoming_payload = {
                    "caller_socket_id": f"pending:{call['id']}",
                    "caller_user_id": call["caller_id"],
                    "caller_username": call["caller_username"],
                    "caller_avatar_url": call["caller_avatar_url"],
                    "pending_call_id": call["id"],
                }
                if offer:
                    incoming_payload["offer"] = offer
                await self.io.emit("incoming_call", incoming_payload, room=sid)
                logger.info(f"Sent pending call {call['id']} to user {user_info['id']}")
        except Exception as e:
            logger.error(f"Error sending pending calls: {e}")

    async def on_disconnect(self, sid):
        user_id = await self.broker.close_session(sid)
        if user_id:
            await self._broadcast_status(user_id, "offline")

    async def on_logout(self, sid, payload=None):
        user_id = await self.broker.close_session(sid)
        if user_id:
            await self._broadcast_status(user_id, "offline")
        try:
            await self.io.disconnect(sid)
        except Exception:
            pass

    async def on_authenticate(self, sid, payload):
        if not payload:
            await self.io.emit("error", {"message": "Требуется данные для аутентификации"}, room=sid)
            return

        access_token = payload.get("access_token")
        if not access_token:
            await self.io.emit("error", {"message": "Требуется токен доступа"}, room=sid)
            return

        user_info = await self.broker.repo.fetch_user_by_token(access_token)
        if not user_info:
            await self.io.emit("error", {"message": "Не авторизовано"}, room=sid)
            return

        if user_info.get("is_blocked"):
            await self.io.emit("error", {"message": "Пользователь заблокирован"}, room=sid)
            return

        await self.io.save_session(sid, {"user_id": user_info["id"]})
        await self.broker.repo.bind_socket(user_info["id"], sid)
        await self.broker.remember_sid_user(sid, user_info["id"])
        await self._broadcast_status(user_info["id"], "online")

        await self.io.enter_room(sid, str(user_info["id"]))
        logger.info(f"Пользователь {user_info['username']} аутентифицирован. SID: {sid}")

        await self.io.emit(
            "connection_success",
            {
                "message": "Аутентификация успешна",
                "user_id": user_info["id"],
                "socket_id": sid,
                "role": user_info.get("role", "User"),
            },
            room=sid
        )

    async def on_get_online_users(self, sid, _payload=None):
        try:
            ids = await self.broker.repo.get_online_user_ids()
            await self.io.emit("online_users", ids, room=sid)
        except Exception as e:
            logger.error(f"get_online_users error: {e}")

    async def _persist_dm_call_notice(self, caller_id, target_user_id, caller_username):
        message_id = str(uuid.uuid4())
        timestamp = datetime.utcnow().isoformat() + "Z"
        label = (caller_username or "Пользователь").strip()
        content = f"📞 Входящий звонок от {label}. Ответьте во всплывающем окне или отклоните вызов."
        msg_data = {
            "id": message_id,
            "sender_id": caller_id,
            "target_id": target_user_id,
            "content": content,
            "attachments": None,
            "type": "call_invite",
            "timestamp": timestamp,
        }
        saved, error = await self.broker.repo.save_message(msg_data)
        if not saved:
            logger.warning(f"call notice DM not saved: {error}")
            return
        target_socket = await self.broker.get_user_socket(target_user_id)
        full_message_payload = {
            "id": message_id,
            "sender_id": caller_id,
            "target_id": target_user_id,
            "content": content,
            "attachments": None,
            "type": "call_invite",
            "timestamp": timestamp,
            "is_read": 0,
        }
        caller_socket = await self.broker.get_user_socket(caller_id)
        if caller_socket:
            await self.io.emit("message_sent", {"status": "delivered", "message": full_message_payload}, room=caller_socket)
        if target_socket:
            await self.io.emit("receive_message", full_message_payload, room=target_socket)

    async def _persist_group_call_notice(self, group_id, sender_id_real, poster_id, caller_username):
        message_id = str(uuid.uuid4())
        timestamp = datetime.utcnow().isoformat() + "Z"
        label = (caller_username or "Участник").strip()
        content = f"📞 Входящий групповой звонок (от {label}). Принять можно во всплывающем окне."
        msg_data = {
            "id": message_id,
            "sender_id": poster_id,
            "group_id": group_id,
            "content": content,
            "attachments": None,
            "type": "call_invite",
            "timestamp": timestamp,
        }
        saved, error = await self.broker.repo.save_message(msg_data)
        if not saved:
            logger.warning(f"call notice group not saved: {error}")
            return
        full_message_payload = {
            "id": message_id,
            "sender_id": poster_id,
            "group_id": group_id,
            "content": content,
            "attachments": None,
            "type": "call_invite",
            "timestamp": timestamp,
            "is_read": 0,
        }
        participants = await self.broker.repo.get_group_participants(group_id)
        for pid in participants:
            pid_socket = await self.broker.get_user_socket(pid)
            if pid_socket:
                await self.io.emit("receive_message", full_message_payload, room=pid_socket)

    async def on_ping(self, sid, payload):
        await self.io.emit("pong_stability", {"timestamp": payload.get("timestamp")}, room=sid)

    async def on_join_voice_channel(self, sid, payload):
        channel_id = payload.get("channel_id")
        if not channel_id:
            await self.io.emit("error", {"message": "Отсутствует channel_id"}, room=sid)
            return
        sender_id, sender = await self._get_sender(sid)
        if not sender_id:
            await self.io.emit("error", {"message": "Не авторизовано"}, room=sid)
            return
        # Allow access to channel for authorized user
        participants = await self.broker.repo.get_channel_participants(channel_id)
        if participants and len(participants) > 0 and str(sender_id) not in [str(p) for p in participants]:
            logger.info(f"[VoiceChannel] User {sender_id} joining voice channel {channel_id}")

        channel_set = self.voice_channel_calls.get(channel_id)
        if channel_set is None:
            channel_set = set()
            self.voice_channel_calls[channel_id] = channel_set

        sender_info = await self.broker.resolve_recipient(sid)
        sender_user = sender or {}

        # 1. Notify joining user of their own arrival so local UI updates participant list
        await self.io.emit(
            "voice_channel_participant_joined",
            {
                "channel_id": channel_id,
                "user_id": sender_id,
                "socket_id": sid,
                "username": sender_info.get("username") if sender_info else sender_user.get("username", "User"),
                "avatar_url": sender_info.get("avatar_url") if sender_info else sender_user.get("avatar_url"),
            },
            room=sid,
        )

        # 2. Cross-notify existing participants and new participant
        for existing_sid in list(channel_set):
            if not await self.broker.resolve_recipient(existing_sid):
                channel_set.discard(existing_sid)
                continue

            await self.io.emit(
                "voice_channel_participant_joined",
                {
                    "channel_id": channel_id,
                    "user_id": sender_id,
                    "socket_id": sid,
                    "username": sender_info.get("username") if sender_info else sender_user.get("username", "User"),
                    "avatar_url": sender_info.get("avatar_url") if sender_info else sender_user.get("avatar_url"),
                },
                room=existing_sid,
            )

            existing_info = await self.broker.resolve_recipient(existing_sid)
            await self.io.emit(
                "voice_channel_participant_joined",
                {
                    "channel_id": channel_id,
                    "user_id": existing_info.get("id") if existing_info else None,
                    "socket_id": existing_sid,
                    "username": existing_info.get("username") if existing_info else None,
                    "avatar_url": existing_info.get("avatar_url") if existing_info else None,
                },
                room=sid,
            )

        channel_set.add(sid)

    async def on_leave_voice_channel(self, sid, payload):
        channel_id = payload.get("channel_id")
        if not channel_id:
            return
        channel_set = self.voice_channel_calls.get(channel_id)
        if not channel_set:
            return
        if sid in channel_set:
            channel_set.discard(sid)

            leaving_info = await self.broker.resolve_recipient(sid)
            for existing_sid in list(channel_set):
                if await self.broker.resolve_recipient(existing_sid):
                    await self.io.emit(
                        "voice_channel_participant_left",
                        {
                            "channel_id": channel_id,
                            "socket_id": sid,
                            "user_id": leaving_info.get("id") if leaving_info else None,
                            "username": leaving_info.get("username") if leaving_info else None,
                        },
                        room=existing_sid,
                    )
            if not channel_set:
                self.voice_channel_calls.pop(channel_id, None)

    async def on_call_user(self, sid, payload):
        target_user_id = str(payload.get("target_user_id")) if payload.get("target_user_id") else None
        offer_sdp = payload.get("offer")
        if not target_user_id:
            await self.io.emit("error", {"message": "Не указан target_user_id"}, room=sid)
            return
        caller = await self.broker.resolve_recipient(sid)
        incoming_payload = {"caller_socket_id": sid}
        if caller:
            incoming_payload["caller_user_id"] = caller.get("id")
            incoming_payload["caller_username"] = caller.get("username")
            if caller.get("avatar_url"):
                incoming_payload["caller_avatar_url"] = caller.get("avatar_url")
        if offer_sdp:
            incoming_payload["offer"] = offer_sdp

        await self.io.emit("incoming_call", incoming_payload, room=target_user_id)
        logger.info(f"Звонок от {sid} к пользователю {target_user_id}")

        try:
            caller_name = caller.get("username", "Пользователь") if caller else "Пользователь"
            call_id = payload.get("call_id") or f"call-{caller.get('id') if caller else 'user'}-{int(time.time()*1000)}"
            target_socket = await self.broker.get_user_socket(target_user_id)
            if not target_socket:
                if offer_sdp:
                    try:
                        offer_json = json.dumps(offer_sdp) if isinstance(offer_sdp, dict) else str(offer_sdp)
                        await self.broker.repo.save_pending_call(
                            caller_id=caller.get("id") if caller else None,
                            target_id=target_user_id,
                            caller_username=caller_name,
                            caller_avatar_url=caller.get("avatar_url") if caller else None,
                            offer_sdp=offer_json,
                            offer_type=offer_sdp.get("type", "offer") if isinstance(offer_sdp, dict) else "offer",
                        )
                        logger.info(f"Pending call saved for user {target_user_id}")
                    except Exception as e:
                        logger.error(f"Failed to save pending call: {e}")

            await self._push_call_user(
                target_user_id,
                {
                    "caller_user_id": str(caller.get("id")) if caller and caller.get("id") else "",
                    "caller_username": str(caller_name),
                    "caller_avatar_url": str(caller.get("avatar_url") or ""),
                    "caller_socket_id": str(sid),
                    "call_id": str(call_id),
                },
            )
        except Exception as e:
            logger.error(f"Call push error: {e}")

        if caller and caller.get("id"):
            try:
                await self._persist_dm_call_notice(
                    str(caller.get("id")),
                    str(target_user_id),
                    caller.get("username"),
                )
            except Exception as e:
                logger.error(f"dm call chat notice failed: {e}")

    async def on_e2e_key_exchange(self, sid, payload):
        target_user_id = str(payload.get("target_user_id")) if payload.get("target_user_id") else None
        public_key = payload.get("public_key")
        key_id = payload.get("key_id")
        if not target_user_id or not public_key or not key_id:
            await self.io.emit("error", {"message": "Отсутствуют данные ключа"}, room=sid)
            return
        sender_id, sender = await self._get_sender(sid)
        if not sender_id:
            await self.io.emit("error", {"message": "Не авторизовано"}, room=sid)
            return
        await self.io.emit(
            "e2e_key_exchange",
            {
                "from_user_id": sender_id,
                "public_key": public_key,
                "key_id": key_id,
                "type": payload.get("type"),
            },
            room=target_user_id,
        )

    async def on_call_answer(self, sid, payload):
        caller_socket_id = payload.get("caller_socket_id") or payload.get("target_socket_id")
        answer = payload.get("answer")
        if not caller_socket_id:
            return
        logger.info(f"Звонок принят: {sid} -> {caller_socket_id}")

        if caller_socket_id.startswith("pending:"):
            call_id = caller_socket_id.split(":", 1)[1]
            try:
                await self.broker.repo.mark_pending_call_answered(call_id)
                from sqlalchemy import text
                async with self.broker.repo._session() as s:
                    res = await s.execute(
                        text("SELECT caller_id, caller_username FROM pending_calls WHERE id = :id"),
                        {"id": call_id}
                    )
                    row = res.fetchone()
                if row:
                    caller_id = row[0]
                    caller_socket = await self.broker.get_user_socket(caller_id)
                    if caller_socket and answer:
                        await self.io.emit("call_answer", {"socket_id": sid, "answer": answer}, room=caller_socket)
                        await self.io.emit("call_accepted", {"responder_socket_id": sid}, room=caller_socket)
                        await self.io.emit("call_migrate", {
                            "old_key": f"pending:{call_id}",
                            "new_key": caller_socket,
                        }, room=sid)
                    elif caller_id:
                        session = await self.io.get_session(sid)
                        await self._push_call_user(caller_id, {
                            "type": "call_accepted",
                            "responder_user_id": str(session.get("user_id") if session else ""),
                            "responder_username": row[1] if row else "Пользователь",
                        })
                await self.broker.repo.delete_pending_call(call_id)
            except Exception as e:
                logger.error(f"Pending call answer error: {e}")
            return

        if answer:
            await self.io.emit("call_answer", {"socket_id": sid, "answer": answer}, room=caller_socket_id)

        await self.io.emit("call_accepted", {"responder_socket_id": sid}, room=caller_socket_id)

    async def on_call_group(self, sid, payload):
        group_id = payload.get("group_id")
        offer_sdp = payload.get("offer")
        if not group_id:
            await self.io.emit("error", {"message": "Отсутствует group_id"}, room=sid)
            return

        sender_id, sender = await self._get_sender(sid)
        if not sender_id:
            await self.io.emit("error", {"message": "Не авторизовано"}, room=sid)
            return

        participants = await self.broker.repo.get_group_participants(group_id)
        if str(sender_id) not in [str(p) for p in participants]:
            await self.io.emit("error", {"message": "Доступ запрещён"}, room=sid)
            return

        online_participants = []
        for pid in participants:
            if str(pid) == str(sender_id):
                continue
            pid_socket = await self.broker.get_user_socket(pid)
            if pid_socket and await self.broker.resolve_recipient(pid_socket):
                online_participants.append({"user_id": pid, "socket_id": pid_socket})

        call_id = str(uuid.uuid4())
        self.group_calls[call_id] = {
            "group_id": group_id,
            "caller_socket_id": sid,
            "caller_user_id": sender_id,
            "participants": [p["user_id"] for p in online_participants],
            "joined": {str(sender_id)},
            "caller_username": sender.get("username") if sender else None,
            "caller_avatar_url": sender.get("avatar_url") if sender else None,
        }

        incoming_payload = {
            "call_id": call_id,
            "group_id": group_id,
            "caller_socket_id": sid,
            "participants": online_participants,
        }
        if sender:
            incoming_payload["caller_user_id"] = sender.get("id")
            incoming_payload["caller_username"] = sender.get("username")
            if sender.get("avatar_url"):
                incoming_payload["caller_avatar_url"] = sender.get("avatar_url")
        if offer_sdp:
            incoming_payload["offer"] = offer_sdp

        for p in online_participants:
            await self.io.emit("incoming_group_call", incoming_payload, room=p["socket_id"])

        if online_participants and sender:
            owner_gid = await self.broker.repo.get_group_owner(group_id)
            poster_id = str(owner_gid) if owner_gid else str(sender_id)
            try:
                await self._persist_group_call_notice(
                    group_id,
                    str(sender_id),
                    poster_id,
                    sender.get("username") if sender else None,
                )
            except Exception as e:
                logger.error(f"group call chat notice failed: {e}")

        await self.io.emit(
            "group_call_started",
            {
                "call_id": call_id,
                "group_id": group_id,
                "participants": online_participants,
                "caller_participant": {
                    "user_id": sender_id,
                    "socket_id": sid,
                    "username": sender.get("username") if sender else None,
                    "avatar_url": sender.get("avatar_url") if sender else None,
                },
            },
            room=sid,
        )

    async def on_group_call_answer(self, sid, payload):
        call_id = payload.get("call_id")
        if not call_id:
            await self.io.emit("error", {"message": "Отсутствует call_id"}, room=sid)
            return

        call = self.group_calls.get(call_id)
        if not call:
            await self.io.emit("error", {"message": "Звонок не найден"}, room=sid)
            return

        sender_id, sender = await self._get_sender(sid)
        if not sender_id:
            await self.io.emit("error", {"message": "Не авторизовано"}, room=sid)
            return

        participants = await self.broker.repo.get_group_participants(call["group_id"])
        if str(sender_id) not in [str(p) for p in participants]:
            await self.io.emit("error", {"message": "Доступ запрещён"}, room=sid)
            return

        call["joined"].add(str(sender_id))
        participants_list = call.get("participants", [])
        if str(sender_id) not in [str(p) for p in participants_list]:
            participants_list.append(sender_id)
            call["participants"] = participants_list

        caller_socket_id = call.get("caller_socket_id")
        caller_user_id = call.get("caller_user_id")
        caller_username = call.get("caller_username")
        caller_avatar_url = call.get("caller_avatar_url")

        if caller_socket_id and await self.broker.resolve_recipient(caller_socket_id):
            await self.io.emit(
                "group_call_accepted",
                {
                    "call_id": call_id,
                    "responder_socket_id": sid,
                    "responder_user_id": sender_id,
                },
                room=caller_socket_id,
            )

        existing_participants = []

        if caller_socket_id and await self.broker.resolve_recipient(caller_socket_id):
            existing_participants.append({
                "user_id": caller_user_id,
                "socket_id": caller_socket_id,
                "username": caller_username,
                "avatar_url": caller_avatar_url,
            })

        for pid in call.get("participants", []):
            if str(pid) in [str(sender_id), str(caller_user_id)]:
                continue
            pid_socket = await self.broker.get_user_socket(pid)
            if pid_socket and await self.broker.resolve_recipient(pid_socket):
                participant_info = await self.broker.resolve_recipient(pid_socket)
                existing_participants.append({
                    "user_id": pid,
                    "socket_id": pid_socket,
                    "username": participant_info.get("username") if participant_info else None,
                    "avatar_url": participant_info.get("avatar_url") if participant_info else None,
                })

        notify_payload = {
            "call_id": call_id,
            "user_id": sender_id,
            "socket_id": sid,
            "username": sender.get("username") if sender else None,
            "avatar_url": sender.get("avatar_url") if sender else None,
        }
        if caller_socket_id and await self.broker.resolve_recipient(caller_socket_id):
            await self.io.emit("group_call_participant_joined", notify_payload, room=caller_socket_id)

        for participant in existing_participants:
            if participant["socket_id"] != caller_socket_id:
                await self.io.emit("group_call_participant_joined", notify_payload, room=participant["socket_id"])

        for participant in existing_participants:
            await self.io.emit(
                "group_call_participant_joined",
                {
                    "call_id": call_id,
                    "user_id": participant["user_id"],
                    "socket_id": participant["socket_id"],
                    "username": participant["username"],
                    "avatar_url": participant["avatar_url"],
                },
                room=sid
            )

    async def on_group_call_reject(self, sid, payload):
        call_id = payload.get("call_id")
        reason = payload.get("reason", "busy")
        if not call_id:
            return

        call = self.group_calls.get(call_id)
        if not call:
            return

        sender_id, _sender = await self._get_sender(sid)
        if not sender_id:
            return

        caller_socket_id = call.get("caller_socket_id")
        if caller_socket_id and await self.broker.resolve_recipient(caller_socket_id):
            await self.io.emit(
                "group_call_rejected",
                {
                    "call_id": call_id,
                    "responder_socket_id": sid,
                    "responder_user_id": sender_id,
                    "reason": reason,
                },
                room=caller_socket_id,
            )

    async def on_group_call_end(self, sid, payload):
        call_id = payload.get("call_id")
        if not call_id:
            return

        call = self.group_calls.get(call_id)
        if not call:
            return

        payload_out = {"call_id": call_id, "sender_socket_id": sid}
        caller_socket_id = call.get("caller_socket_id")
        if caller_socket_id and await self.broker.resolve_recipient(caller_socket_id):
            await self.io.emit("group_call_ended", payload_out, room=caller_socket_id)
        for pid in call.get("participants", []):
            pid_socket = await self.broker.get_user_socket(pid)
            if pid_socket and await self.broker.resolve_recipient(pid_socket):
                await self.io.emit("group_call_ended", payload_out, room=pid_socket)

        self.group_calls.pop(call_id, None)

    async def on_get_active_group_call(self, sid, payload):
        group_id = payload.get("group_id")
        if not group_id:
            await self.io.emit("active_group_call", {"error": "Отсутствует group_id"}, room=sid)
            return

        active_call = None
        for cid, call in self.group_calls.items():
            if str(call.get("group_id")) == str(group_id):
                active_call = {
                    "call_id": cid,
                    "group_id": group_id,
                    "caller_user_id": call.get("caller_user_id"),
                    "caller_username": call.get("caller_username"),
                    "caller_avatar_url": call.get("caller_avatar_url"),
                    "participants_count": len(call.get("joined", []))
                }
                break

        await self.io.emit("active_group_call", {"active_call": active_call}, room=sid)

    async def on_get_group_history(self, sid, payload):
        group_id = payload.get("group_id")
        limit = payload.get("limit", 50)
        offset = payload.get("offset", 0)

        if not group_id:
            await self.io.emit("error", {"message": "Отсутствует group_id"}, room=sid)
            return

        sender_id, _ = await self._get_sender(sid)
        if not sender_id:
            await self.io.emit("error", {"message": "Не авторизовано"}, room=sid)
            return

        participants = await self.broker.repo.get_group_participants(group_id)
        if str(sender_id) not in [str(p) for p in participants]:
            await self.io.emit("error", {"message": "Доступ запрещён"}, room=sid)
            return

        messages = await self.broker.repo.get_group_history(
            group_id, limit, offset, viewer_id=sender_id
        )

        for msg in messages:
            for key, value in msg.items():
                if isinstance(value, datetime):
                    msg[key] = value.isoformat()

        await self.io.emit("group_history", {"group_id": group_id, "messages": messages}, room=sid)

    async def on_get_history(self, sid, payload):
        target_id = payload.get("target_id")
        limit = payload.get("limit", 50)
        offset = payload.get("offset", 0)

        if not target_id:
            await self.io.emit("error", {"message": "Отсутствует target_id"}, room=sid)
            return

        sender_id, _ = await self._get_sender(sid)
        if not sender_id:
            await self.io.emit("error", {"message": "Не авторизовано"}, room=sid)
            return

        messages = await self.broker.repo.get_messages_history(
            sender_id, target_id, limit, offset
        )

        for msg in messages:
            for key, value in msg.items():
                if isinstance(value, datetime):
                    msg[key] = value.isoformat()

        await self.io.emit("history", {"target_id": target_id, "messages": messages}, room=sid)

    async def on_call_reject(self, sid, payload):
        caller_socket_id = payload.get("caller_socket_id")
        if not caller_socket_id:
            return
        logger.info(f"Звонок отклонен: {sid} -> {caller_socket_id}")

        if caller_socket_id.startswith("pending:"):
            call_id = caller_socket_id.split(":", 1)[1]
            try:
                from sqlalchemy import text
                async with self.broker.repo._session() as s:
                    res = await s.execute(
                        text("SELECT caller_id FROM pending_calls WHERE id = :id"),
                        {"id": call_id}
                    )
                    row = res.fetchone()
                caller_id = row[0] if row else None
                await self.broker.repo.delete_pending_call(call_id)
                if caller_id:
                    caller_socket = await self.broker.get_user_socket(caller_id)
                    if caller_socket:
                        await self.io.emit("call_rejected", {
                            "responder_socket_id": sid,
                            "reason": "busy",
                        }, room=caller_socket)
            except Exception:
                pass
            return

        await self.io.emit(
            "call_rejected",
            {"responder_socket_id": sid, "reason": "busy"},
            room=caller_socket_id,
        )

    async def on_call_end(self, sid, payload):
        target_socket_id = payload.get("target_socket_id")
        pending_call_id = payload.get("pending_call_id")
        if not target_socket_id:
            return
        logger.info(f"Завершение звонка: {sid} -> {target_socket_id}")

        if pending_call_id:
            try:
                await self.broker.repo.delete_pending_call(pending_call_id)
            except Exception:
                pass

        await self.io.emit("call_ended", {"sender_socket_id": sid}, room=target_socket_id)

    async def on_offer(self, sid, payload):
        target_sid = payload.get("target_socket_id")
        offer_sdp = payload.get("offer")
        if not target_sid or not offer_sdp:
            return
        logger.info(f"Пересылка OFFER: {sid} -> {target_sid}")
        await self.io.emit(
            "offer",
            {"offer": offer_sdp, "sender_socket_id": sid},
            room=target_sid,
        )

    async def on_answer(self, sid, payload):
        target_sid = payload.get("target_socket_id")
        answer_sdp = payload.get("answer")
        if not target_sid or not answer_sdp:
            return
        if target_sid.startswith("pending:"):
            return
        logger.info(f"Пересылка ANSWER: {sid} -> {target_sid}")
        await self.io.emit(
            "answer",
            {"answer": answer_sdp, "sender_socket_id": sid},
            room=target_sid,
        )

    async def on_ice(self, sid, payload):
        target_sid = payload.get("target_socket_id")
        target_user_id = payload.get("target_user_id")
        candidate_data = payload.get("candidate")
        if not candidate_data:
            return
        if target_sid and target_sid.startswith("pending:"):
            return
        if not target_sid and target_user_id:
            target_sid = await self.broker.get_user_socket(target_user_id)
        if not target_sid:
            return
        await self.io.emit(
            "ice_candidate",
            {"candidate": candidate_data, "sender_socket_id": sid},
            room=target_sid,
        )

    async def on_send_message(self, sid, payload):
        target_user_id = payload.get("target_user_id")
        channel_id = payload.get("channel_id")
        group_id = payload.get("group_id")
        reply_to = payload.get("reply_to")
        thread_id = payload.get("thread_id")
        content = payload.get("content")
        attachments = payload.get("attachments")
        msg_type = payload.get("type", "text")
        forwarded_from = payload.get("forwarded_from")
        disappear_after = payload.get("disappear_after")

        if (
            attachments is not None
            and not isinstance(attachments, list)
            and not isinstance(attachments, str)
        ):
            await self.io.emit("error", {"message": "attachments must be a list"}, room=sid)
            return

        if not content and not attachments:
            await self.io.emit("error", {"message": "Content or attachments is required"}, room=sid)
            return

        if not content:
            content = ""

        if not target_user_id and not channel_id and not group_id:
            await self.io.emit("error", {"message": "Missing target_user_id, channel_id or group_id"}, room=sid)
            return

        sender_id, sender = await self._get_sender(sid)
        if not sender_id:
            await self.io.emit("error", {"message": "Unauthorized"}, room=sid)
            return

        message_id = str(uuid.uuid4())
        timestamp = datetime.utcnow().isoformat() + "Z"

        if channel_id:
            participants = await self.broker.repo.get_channel_participants(channel_id)
            if not participants:
                owner_id = await self.broker.repo.get_channel_owner(channel_id)
                if not owner_id:
                    await self.io.emit("error", {"message": "Channel not found"}, room=sid)
                    return
                participants = [owner_id]

            if str(sender_id) not in [str(p) for p in participants]:
                await self.io.emit("error", {"message": "You are not a participant of this channel"}, room=sid)
                return

            msg_data = {
                "id": message_id,
                "sender_id": sender_id,
                "channel_id": channel_id,
                "reply_to": reply_to,
                "thread_id": thread_id,
                "content": content,
                "attachments": attachments,
                "type": msg_type,
                "timestamp": timestamp,
            }

            saved, error = await self.broker.repo.save_message(msg_data)
            if not saved:
                await self.io.emit("error", {"message": f"Failed to save message: {error}"}, room=sid)
                return

            full_message_payload = {
                "id": message_id,
                "sender_id": sender_id,
                "channel_id": channel_id,
                "reply_to": reply_to,
                "thread_id": thread_id,
                "content": content,
                "attachments": attachments,
                "type": msg_type,
                "timestamp": timestamp,
                "is_read": 0,
            }

            await self.io.emit("message_sent", {"status": "delivered", "message": full_message_payload}, room=sid)

            for pid in participants:
                if str(pid) == str(sender_id):
                    continue
                pid_socket = await self.broker.get_user_socket(pid)
                if pid_socket:
                    await self.io.emit("receive_message", full_message_payload, room=pid_socket)

        elif group_id:
            participants = await self.broker.repo.get_group_participants(group_id)
            if str(sender_id) not in [str(p) for p in participants]:
                await self.io.emit("error", {"message": "You are not a participant of this group"}, room=sid)
                return

            msg_data = {
                "id": message_id,
                "sender_id": sender_id,
                "group_id": group_id,
                "reply_to": reply_to,
                "thread_id": thread_id,
                "content": content,
                "attachments": attachments,
                "type": msg_type,
                "timestamp": timestamp,
            }

            saved, error = await self.broker.repo.save_message(msg_data)
            if not saved:
                await self.io.emit("error", {"message": f"Failed to save message: {error}"}, room=sid)
                return

            full_message_payload = {
                "id": message_id,
                "sender_id": sender_id,
                "group_id": group_id,
                "reply_to": reply_to,
                "thread_id": thread_id,
                "content": content,
                "attachments": attachments,
                "type": msg_type,
                "timestamp": timestamp,
                "is_read": 0,
            }

            await self.io.emit("message_sent", {"status": "delivered", "message": full_message_payload}, room=sid)

            for pid in participants:
                if str(pid) == str(sender_id):
                    continue
                pid_socket = await self.broker.get_user_socket(pid)
                if pid_socket:
                    await self.io.emit("receive_message", full_message_payload, room=pid_socket)

        else:
            msg_data = {
                "id": message_id,
                "sender_id": sender_id,
                "target_id": target_user_id,
                "reply_to": reply_to,
                "thread_id": thread_id,
                "content": content,
                "attachments": attachments,
                "type": msg_type,
                "timestamp": timestamp,
            }

            if forwarded_from:
                msg_data["forwarded_from_id"] = forwarded_from.get("sender_id")

            if disappear_after and int(disappear_after) > 0:
                from datetime import timedelta as td
                msg_data["disappear_after"] = int(disappear_after)
                msg_data["disappear_at"] = datetime.utcnow() + td(seconds=int(disappear_after))

            saved, error = await self.broker.repo.save_message(msg_data)
            if not saved:
                await self.io.emit("error", {"message": f"Failed to save message: {error}"}, room=sid)
                return

            target_socket = await self.broker.get_user_socket(target_user_id)

            full_message_payload = {
                "id": message_id,
                "sender_id": sender_id,
                "target_id": target_user_id,
                "reply_to": reply_to,
                "thread_id": thread_id,
                "content": content,
                "attachments": attachments,
                "type": msg_type,
                "timestamp": timestamp,
                "is_read": 0,
            }

            if forwarded_from:
                full_message_payload["forwarded_from"] = forwarded_from

            if disappear_after and int(disappear_after) > 0:
                full_message_payload["disappear_after"] = int(disappear_after)
                full_message_payload["disappear_at"] = (datetime.utcnow() + td(seconds=int(disappear_after))).isoformat() + "Z"

            if target_socket:
                await self.io.emit("receive_message", full_message_payload, room=target_socket)
                await self.io.emit("message_sent", {"status": "delivered", "message": full_message_payload}, room=sid)
            else:
                await self.io.emit("message_sent", {"status": "saved", "message": full_message_payload}, room=sid)

            try:
                sender_info = await self.broker.resolve_recipient(sid)
                if sender_info:
                    sender_name = getattr(sender_info, "username", None) or (sender_info.get("username") if isinstance(sender_info, dict) else "Пользователь")
                else:
                    sender_name = "Пользователь"
                push_title = f"{sender_name}"
                push_body = self._get_push_body(content, msg_type)
                logger.info(f"Triggering DM push notification for target_user_id={target_user_id} from {sender_name}")
                await self._push_notify_user(
                    target_user_id,
                    push_title,
                    push_body,
                    {"message_id": message_id, "sender_id": sender_id},
                )
            except Exception as e:
                logger.error(f"Push notification error for DM: {e}", exc_info=True)

            try:
                import aiohttp
                bot_url = f"{Config.BACKEND_INTERNAL_URL}/api/v1/bots/{target_user_id}/updates/push"
                bot_payload = {
                    "update_id": int(datetime.utcnow().timestamp() * 1000),
                    "message": {
                        "message_id": message_id,
                        "from": {
                            "id": str(sender_id),
                            "username": sender_name,
                            "first_name": sender_name,
                        },
                        "chat": {
                            "id": str(sender_id),
                            "type": "private",
                        },
                        "text": content or "",
                        "date": int(datetime.utcnow().timestamp()),
                    }
                }
                async with aiohttp.ClientSession() as session:
                    await session.post(bot_url, json=bot_payload, timeout=2)
            except Exception:
                pass

            try:
                import httpx
                backend_url = f"{Config.BACKEND_INTERNAL_URL}/api/v1/users/internal/process_message"
                async with httpx.AsyncClient(timeout=1) as client:
                    await client.post(
                        backend_url,
                        json={
                            "message_id": message_id,
                            "sender_id": sender_id,
                            "target_id": target_user_id,
                            "content": content,
                            "type": msg_type,
                        },
                    )
            except Exception as e:
                logger.error(f"Error notifying backend about AI DM: {e}")

    async def on_delete_message(self, sid, payload):
        message_id = payload.get("message_id") if isinstance(payload, dict) else None
        if not message_id:
            await self.io.emit("error", {"message": "message_id is required"}, room=sid)
            return

        sender_id, _ = await self._get_sender(sid)
        if not sender_id:
            await self.io.emit("error", {"message": "Unauthorized"}, room=sid)
            return

        meta = await self.broker.repo.get_message_meta(message_id)
        if not meta:
            await self.io.emit("error", {"message": "Message not found"}, room=sid)
            return

        ok, reason = await self.broker.repo.mark_message_deleted(message_id, sender_id)
        if not ok:
            if reason == "forbidden":
                await self.io.emit("error", {"message": "Forbidden"}, room=sid)
            elif reason == "not_found":
                await self.io.emit("error", {"message": "Message not found"}, room=sid)
            else:
                await self.io.emit("error", {"message": "Failed to delete message"}, room=sid)
            return

        payload_out = {"id": message_id}

        if meta.get("channel_id"):
            participants = await self.broker.repo.get_channel_participants(meta["channel_id"])
            for pid in participants:
                pid_socket = await self.broker.get_user_socket(pid)
                if pid_socket:
                    await self.io.emit("message_deleted", payload_out, room=pid_socket)
            return

        if meta.get("group_id"):
            participants = await self.broker.repo.get_group_participants(meta["group_id"])
            for pid in participants:
                pid_socket = await self.broker.get_user_socket(pid)
                if pid_socket:
                    await self.io.emit("message_deleted", payload_out, room=pid_socket)
            return

        target_user_id = meta.get("target_id")
        await self.io.emit("message_deleted", payload_out, room=sid)
        if target_user_id:
            target_socket = await self.broker.get_user_socket(target_user_id)
            if target_socket:
                await self.io.emit("message_deleted", payload_out, room=target_socket)

    async def on_edit_message(self, sid, payload):
        message_id = payload.get("message_id") if isinstance(payload, dict) else None
        new_content = payload.get("content") if isinstance(payload, dict) else None
        if not message_id or not new_content:
            await self.io.emit("error", {"message": "message_id and content are required"}, room=sid)
            return

        sender_id, _ = await self._get_sender(sid)
        if not sender_id:
            await self.io.emit("error", {"message": "Unauthorized"}, room=sid)
            return

        ok = await self.broker.repo.edit_message(message_id, sender_id, new_content)
        if not ok:
            await self.io.emit("error", {"message": "Failed to edit message"}, room=sid)
            return

        meta = await self.broker.repo.get_message_meta(message_id)
        if not meta:
            await self.io.emit("error", {"message": "Message not found"}, room=sid)
            return

        edit_payload = {
            "id": message_id,
            "content": new_content,
            "is_edited": True,
        }

        if meta.get("channel_id"):
            participants = await self.broker.repo.get_channel_participants(meta["channel_id"])
            for pid in participants:
                pid_socket = await self.broker.get_user_socket(pid)
                if pid_socket:
                    await self.io.emit("message_edited", edit_payload, room=pid_socket)
            return

        if meta.get("group_id"):
            participants = await self.broker.repo.get_group_participants(meta["group_id"])
            for pid in participants:
                pid_socket = await self.broker.get_user_socket(pid)
                if pid_socket:
                    await self.io.emit("message_edited", edit_payload, room=pid_socket)
            return

        target_user_id = meta.get("target_id")
        await self.io.emit("message_edited", edit_payload, room=sid)
        if target_user_id:
            target_socket = await self.broker.get_user_socket(target_user_id)
            if target_socket:
                await self.io.emit("message_edited", edit_payload, room=target_socket)

    async def on_post_create(self, sid, payload):
        if not isinstance(payload, dict):
            await self.io.emit("error", {"message": "Invalid payload"}, room=sid)
            return
        post_id = payload.get("id")
        posted_by = payload.get("posted_by")
        if not post_id or not posted_by:
            await self.io.emit("error", {"message": "id and posted_by are required"}, room=sid)
            return
        await self.io.emit("post_created", payload)

    async def on_post_update(self, sid, payload):
        if not isinstance(payload, dict):
            await self.io.emit("error", {"message": "Invalid payload"}, room=sid)
            return
        post_id = payload.get("id")
        if not post_id:
            await self.io.emit("error", {"message": "id is required"}, room=sid)
            return
        await self.io.emit("post_updated", payload)

    async def on_post_delete(self, sid, payload):
        if not isinstance(payload, dict):
            await self.io.emit("error", {"message": "Invalid payload"}, room=sid)
            return
        post_id = payload.get("id")
        if not post_id:
            await self.io.emit("error", {"message": "id is required"}, room=sid)
            return
        await self.io.emit("post_deleted", {"id": post_id})

    async def on_video_create(self, sid, payload):
        if not isinstance(payload, dict):
            await self.io.emit("error", {"message": "Invalid payload"}, room=sid)
            return
        video_id = payload.get("id")
        author_id = payload.get("author_id")
        title = payload.get("title")
        url = payload.get("url")
        if not video_id or not author_id or not title or not url:
            await self.io.emit("error", {"message": "id, author_id, title, url required"}, room=sid)
            return
        try:
            await self.broker.repo.save_video(payload)
        except Exception:
            pass
        await self.io.emit("video_created", payload)

    async def on_video_update(self, sid, payload):
        if not isinstance(payload, dict):
            await self.io.emit("error", {"message": "Invalid payload"}, room=sid)
            return
        video_id = payload.get("id")
        if not video_id:
            await self.io.emit("error", {"message": "id is required"}, room=sid)
            return
        try:
            updates = {k: v for k, v in payload.items() if k != "id"}
            if updates:
                await self.broker.repo.update_video(video_id, updates)
        except Exception:
            pass
        await self.io.emit("video_updated", payload)

    async def on_video_delete(self, sid, payload):
        if not isinstance(payload, dict):
            await self.io.emit("error", {"message": "Invalid payload"}, room=sid)
            return
        video_id = payload.get("id")
        if not video_id:
            await self.io.emit("error", {"message": "id is required"}, room=sid)
            return
        try:
            await self.broker.repo.delete_video(video_id)
        except Exception:
            pass
        await self.io.emit("video_deleted", {"id": video_id})

    async def _get_message_participants(self, meta):
        if not meta:
            return []
        if meta.get("channel_id"):
            participants = await self.broker.repo.get_channel_participants(meta["channel_id"])
            return participants or []
        if meta.get("group_id"):
            participants = await self.broker.repo.get_group_participants(meta["group_id"])
            return participants or []
        sender_id = meta.get("sender_id")
        target_id = meta.get("target_id")
        participants = []
        if sender_id:
            participants.append(sender_id)
        if target_id and target_id != sender_id:
            participants.append(target_id)
        return participants

    async def on_react_message(self, sid, payload):
        if not isinstance(payload, dict):
            await self.io.emit("error", {"message": "Invalid payload"}, room=sid)
            return

        message_id = payload.get("message_id")
        emoji = payload.get("emoji")
        if not message_id or not emoji:
            await self.io.emit("error", {"message": "message_id and emoji are required"}, room=sid)
            return

        sender_id, _ = await self._get_sender(sid)
        if not sender_id:
            await self.io.emit("error", {"message": "Unauthorized"}, room=sid)
            return

        meta = await self.broker.repo.get_message_meta(message_id)
        if not meta:
            await self.io.emit("error", {"message": "Message not found"}, room=sid)
            return

        participants = await self._get_message_participants(meta)
        if not participants or str(sender_id) not in [str(p) for p in participants]:
            await self.io.emit("error", {"message": "Forbidden"}, room=sid)
            return

        current_reactions = meta.get('reactions')
        if current_reactions:
            try:
                reactions_dict = json.loads(current_reactions)
            except BaseException:
                reactions_dict = {}
        else:
            reactions_dict = {}

        if emoji in reactions_dict:
            users_for_emoji = set(reactions_dict[emoji])
            if sender_id in users_for_emoji:
                users_for_emoji.remove(sender_id)
                if not users_for_emoji:
                    del reactions_dict[emoji]
                else:
                    reactions_dict[emoji] = list(users_for_emoji)
            else:
                users_for_emoji.add(sender_id)
                reactions_dict[emoji] = list(users_for_emoji)
        else:
            reactions_dict[emoji] = [sender_id]

        try:
            updated_reactions = json.dumps(reactions_dict) if reactions_dict else None
            ok = await self.broker.repo.update_message_reactions(message_id, updated_reactions)
            if not ok:
                await self.io.emit("error", {"message": "Failed to update reactions"}, room=sid)
                return
        except Exception as e:
            logger.error(f"DB Error updating reactions: {e}")
            await self.io.emit("error", {"message": "Failed to update reactions"}, room=sid)
            return

        count = len(reactions_dict.get(emoji, []))
        event_payload = {
            "id": message_id,
            "emoji": emoji,
            "count": count,
            "sender_id": sender_id,
        }

        for pid in participants:
            pid_socket = await self.broker.get_user_socket(pid)
            if pid_socket:
                await self.io.emit("message_reaction_update", event_payload, room=pid_socket)

    async def on_pin_message(self, sid, payload):
        if not isinstance(payload, dict):
            await self.io.emit("error", {"message": "Invalid payload"}, room=sid)
            return

        message_id = payload.get("message_id")
        if not message_id:
            await self.io.emit("error", {"message": "message_id is required"}, room=sid)
            return

        sender_id, _ = await self._get_sender(sid)
        if not sender_id:
            await self.io.emit("error", {"message": "Unauthorized"}, room=sid)
            return

        meta = await self.broker.repo.get_message_meta(message_id)
        if not meta:
            await self.io.emit("error", {"message": "Message not found"}, room=sid)
            return

        participants = await self._get_message_participants(meta)
        if not participants or str(sender_id) not in [str(p) for p in participants]:
            await self.io.emit("error", {"message": "Forbidden"}, room=sid)
            return

        current_pinned_by = meta.get('pinned_by')
        if current_pinned_by:
            pinned = False
            new_pinned_by = None
        else:
            pinned = True
            new_pinned_by = str(sender_id)

        try:
            ok = await self.broker.repo.update_message_pinned_by(message_id, new_pinned_by)
            if not ok:
                await self.io.emit("error", {"message": "Failed to update pinned status"}, room=sid)
                return
        except Exception as e:
            logger.error(f"DB Error updating pinned status: {e}")
            await self.io.emit("error", {"message": "Failed to update pinned status"}, room=sid)
            return

        event_payload = {
            "id": message_id,
            "pinned": pinned,
            "pinned_by": new_pinned_by
        }

        for pid in participants:
            pid_socket = await self.broker.get_user_socket(pid)
            if pid_socket:
                await self.io.emit("message_pinned", event_payload, room=pid_socket)

    async def on_typing(self, sid, payload):
        target_user_id = payload.get("target_user_id")
        if not target_user_id:
            return

        sender_id, _ = await self._get_sender(sid)
        if not sender_id:
            return

        target_socket = await self.broker.get_user_socket(target_user_id)
        if target_socket:
            await self.io.emit("typing", {"sender_id": sender_id}, room=target_socket)

    async def on_stop_typing(self, sid, payload):
        target_user_id = payload.get("target_user_id")
        if not target_user_id:
            return

        sender_id, _ = await self._get_sender(sid)
        if not sender_id:
            return

        target_socket = await self.broker.get_user_socket(target_user_id)
        if target_socket:
            await self.io.emit("stop_typing", {"sender_id": sender_id}, room=target_socket)

    async def on_message_read(self, sid, payload):
        message_ids = payload.get("message_ids")
        target_sender_id = payload.get("target_sender_id")
        if not message_ids:
            return

        reader_id, _ = await self._get_sender(sid)
        if not reader_id:
            return

        await self.broker.repo.mark_messages_as_read(message_ids, reader_id)

        if target_sender_id:
            sender_socket = await self.broker.get_user_socket(target_sender_id)
            if sender_socket:
                await self.io.emit(
                    "messages_read_update",
                    {"message_ids": message_ids, "reader_id": reader_id},
                    room=sender_socket,
                )

    async def on_video_state_changed(self, sid, payload):
        if not payload:
            return

        sender_id, sender = await self._get_sender(sid)
        if not sender_id:
            return

        socket_id = payload.get("sender_socket_id") or sid
        has_video = payload.get("has_video", False)
        user_id = payload.get("user_id") or sender_id

        call_id = payload.get("call_id")
        if call_id and call_id in self.group_calls:
            call = self.group_calls[call_id]
            participants = call.get("participants", [])
            for pid in participants:
                if str(pid) == str(sender_id):
                    continue
                pid_socket = await self.broker.get_user_socket(pid)
                if pid_socket and await self.broker.resolve_recipient(pid_socket):
                    await self.io.emit(
                        "video_state_changed",
                        {
                            "from_socket_id": socket_id,
                            "user_id": user_id,
                            "has_video": has_video,
                        },
                        room=pid_socket,
                    )

        channel_id = payload.get("channel_id")
        if channel_id and channel_id in self.voice_channel_calls:
            channel_set = self.voice_channel_calls[channel_id]
            for existing_sid in list(channel_set):
                if existing_sid == socket_id:
                    continue
                if await self.broker.resolve_recipient(existing_sid):
                    await self.io.emit(
                        "video_state_changed",
                        {
                            "from_socket_id": socket_id,
                            "user_id": user_id,
                            "has_video": has_video,
                        },
                        room=existing_sid,
                    )

    async def on_screen_share_state_changed(self, sid, payload):
        if not payload:
            return

        sender_id, sender = await self._get_sender(sid)
        if not sender_id:
            return

        socket_id = payload.get("sender_socket_id") or sid
        is_sharing = payload.get("is_sharing", False)
        user_id = payload.get("user_id") or sender_id

        for call_id, call in list(self.group_calls.items()):
            participants = call.get("participants", [])
            for pid in participants:
                if str(pid) == str(sender_id):
                    continue
                pid_socket = await self.broker.get_user_socket(pid)
                if pid_socket and await self.broker.resolve_recipient(pid_socket):
                    await self.io.emit(
                        "screen_share_state_changed",
                        {
                            "from_socket_id": socket_id,
                            "user_id": user_id,
                            "is_sharing": is_sharing,
                        },
                        room=pid_socket,
                    )

        for channel_id, channel_set in list(self.voice_channel_calls.items()):
            for existing_sid in list(channel_set):
                if existing_sid == socket_id:
                    continue
                if await self.broker.resolve_recipient(existing_sid):
                    await self.io.emit(
                        "screen_share_state_changed",
                        {
                            "from_socket_id": socket_id,
                            "user_id": user_id,
                            "is_sharing": is_sharing,
                        },
                        room=existing_sid,
                    )
