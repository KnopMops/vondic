import logging
import time
import uuid
from collections import defaultdict, deque
from datetime import datetime
from threading import Lock

from flask import request, session
from flask_socketio import ConnectionRefusedError, emit, join_room

from .config import Config
from .proxy import ConnectionBroker

logger = logging.getLogger(__name__)


class SignalingService:
    def __init__(self, socket_server, broker: ConnectionBroker):
        self.io = socket_server
        self.broker = broker
        self.group_calls = {}
        self.voice_channel_calls = {}
        self._connect_buckets = defaultdict(deque)
        self._connect_lock = Lock()
        self._connect_limit = 20
        self._connect_window_seconds = 60
        self._message_reactions = defaultdict(lambda: defaultdict(set))
        self._pinned_messages = set()
        self._bind_events()

    def _bind_events(self):
        self.io.on_event("connect", self.on_connect)
        self.io.on_event("disconnect", self.on_disconnect)
        self.io.on_event("ping_stability", self.on_ping)
        self.io.on_event("offer", self.on_offer)
        self.io.on_event("answer", self.on_answer)
        self.io.on_event("ice_candidate", self.on_ice)
        self.io.on_event("call_user", self.on_call_user)
        self.io.on_event("call_answer", self.on_call_answer)
        self.io.on_event("call_reject", self.on_call_reject)
        self.io.on_event("call_end", self.on_call_end)
        self.io.on_event("call_group", self.on_call_group)
        self.io.on_event("group_call_answer", self.on_group_call_answer)
        self.io.on_event("group_call_reject", self.on_group_call_reject)
        self.io.on_event("group_call_end", self.on_group_call_end)
        self.io.on_event("join_voice_channel", self.on_join_voice_channel)
        self.io.on_event("leave_voice_channel", self.on_leave_voice_channel)
        self.io.on_event("send_message", self.on_send_message)
        self.io.on_event("delete_message", self.on_delete_message)
        self.io.on_event("react_message", self.on_react_message)
        self.io.on_event("pin_message", self.on_pin_message)
        self.io.on_event("post_create", self.on_post_create)
        self.io.on_event("post_update", self.on_post_update)
        self.io.on_event("post_delete", self.on_post_delete)
        self.io.on_event("video_create", self.on_video_create)
        self.io.on_event("video_update", self.on_video_update)
        self.io.on_event("video_delete", self.on_video_delete)
        self.io.on_event("e2e_key_exchange", self.on_e2e_key_exchange)
        self.io.on_event("typing", self.on_typing)
        self.io.on_event("stop_typing", self.on_stop_typing)
        self.io.on_event("message_read", self.on_message_read)
        self.io.on_event("get_group_history", self.on_get_group_history)
        self.io.on_event("get_history", self.on_get_history)

    def _client_key(self):
        forwarded = request.headers.get("X-Forwarded-For", "")
        if forwarded:
            return forwarded.split(",")[0].strip()
        return request.remote_addr or "unknown"

    def _allow_connect(self):
        now = time.time()
        key = self._client_key()
        with self._connect_lock:
            bucket = self._connect_buckets[key]
            cutoff = now - self._connect_window_seconds
            while bucket and bucket[0] <= cutoff:
                bucket.popleft()
            if len(bucket) >= self._connect_limit:
                return False
            bucket.append(now)
        return True

    def _get_sender(self):
        sender_id = session.get("user_id")
        sender = None
        if not sender_id:
            sender = self.broker.resolve_recipient(request.sid)
            if sender:
                sender_id = sender.get("id")
        if not sender:
            sender = self.broker.resolve_recipient(request.sid)
        return sender_id, sender

    def on_connect(self, auth=None):
        if not self._allow_connect():
            logger.warning("Отклонено: превышен лимит подключений")
            raise ConnectionRefusedError(
                "429 Too Many Requests: Превышен лимит подключений")
        token_value = None
        if auth and isinstance(auth, dict):
            token_value = auth.get("token")
        if not token_value:
            token_value = request.args.get("token")
        if not token_value:
            logger.warning("Отклонено: Токен не предоставлен")
            raise ConnectionRefusedError(
                "401 Unauthorized: Токен не предоставлен")
        current_socket = request.sid
        user_info = self.broker.register_session(token_value, current_socket)
        if not user_info:
            logger.warning("Отклонено: Ошибка регистрации сессии")
            raise ConnectionRefusedError(
                "401 Unauthorized: Ошибка регистрации")

        session["user_id"] = user_info["id"]

        join_room(user_info["id"])
        logger.info(
            f"Пользователь {user_info['username']} подключен. SID: {current_socket}"
        )
        emit(
            "connection_success",
            {
                "message": "Успешное подключение",
                "user_id": user_info["id"],
                "socket_id": current_socket,
                "role": user_info.get("role", "User"),
            },
        )

    def on_disconnect(self):
        self.broker.close_session(request.sid)

    def on_ping(self, payload):
        emit("pong_stability", {"timestamp": payload.get("timestamp")})

    def on_join_voice_channel(self, payload):
        channel_id = payload.get("channel_id")
        if not channel_id:
            emit("error", {"message": "Missing channel_id"})
            return
        sender_id, sender = self._get_sender()
        if not sender_id:
            emit("error", {"message": "Unauthorized"})
            return
        participants = self.broker.repo.get_channel_participants(channel_id)
        if str(sender_id) not in [str(p) for p in participants]:
            emit("error", {"message": "Access denied"})
            return
        channel_set = self.voice_channel_calls.get(channel_id)
        if channel_set is None:
            channel_set = set()
            self.voice_channel_calls[channel_id] = channel_set
        for existing_sid in list(channel_set):
            if not self.broker.resolve_recipient(existing_sid):
                channel_set.discard(existing_sid)
                continue
            emit(
                "voice_channel_participant_joined",
                {"channel_id": channel_id, "user_id": sender_id,
                    "socket_id": request.sid},
                room=existing_sid,
            )
            emit(
                "voice_channel_participant_joined",
                {"channel_id": channel_id, "user_id": self.broker.resolve_recipient(
                    existing_sid).get("id"), "socket_id": existing_sid},
            )
        channel_set.add(request.sid)

    def on_leave_voice_channel(self, payload):
        channel_id = payload.get("channel_id")
        if not channel_id:
            return
        channel_set = self.voice_channel_calls.get(channel_id)
        if not channel_set:
            return
        if request.sid in channel_set:
            channel_set.discard(request.sid)
            for existing_sid in list(channel_set):
                if self.broker.resolve_recipient(existing_sid):
                    emit(
                        "voice_channel_participant_left",
                        {"channel_id": channel_id, "socket_id": request.sid},
                        room=existing_sid,
                    )
            if not channel_set:
                self.voice_channel_calls.pop(channel_id, None)

    def on_call_user(self, payload):
        target_user_id = payload.get("target_user_id")
        offer_sdp = payload.get("offer")
        if not target_user_id:
            emit("error", {"message": "Не указан target_user_id"})
            return
        target_socket = self.broker.get_user_socket(target_user_id)
        if target_socket and self.broker.resolve_recipient(target_socket):
            logger.info(
                f"Звонок от {request.sid} к пользователю {target_user_id} (socket: {target_socket})"
            )
            caller = self.broker.resolve_recipient(request.sid)
            incoming_payload = {"caller_socket_id": request.sid}
            if caller:
                incoming_payload["caller_user_id"] = caller.get("id")
                incoming_payload["caller_username"] = caller.get("username")
                if caller.get("avatar_url"):
                    incoming_payload["caller_avatar_url"] = caller.get(
                        "avatar_url")
            if offer_sdp:
                incoming_payload["offer"] = offer_sdp
            emit("incoming_call", incoming_payload, room=target_user_id)
        else:
            emit("call_failed", {
                 "message": "Пользователь не в сети или не найден"})

    def on_e2e_key_exchange(self, payload):
        target_user_id = payload.get("target_user_id")
        public_key = payload.get("public_key")
        key_id = payload.get("key_id")
        if not target_user_id or not public_key or not key_id:
            emit("error", {"message": "Missing key data"})
            return
        sender_id, sender = self._get_sender()
        if not sender_id:
            emit("error", {"message": "Unauthorized"})
            return
        emit(
            "e2e_key_exchange",
            {
                "from_user_id": sender_id,
                "public_key": public_key,
                "key_id": key_id,
            },
            room=target_user_id,
        )

    def on_call_answer(self, payload):
        caller_socket_id = payload.get("caller_socket_id")
        if not caller_socket_id:
            return
        if self.broker.resolve_recipient(caller_socket_id):
            logger.info(f"Звонок принят: {request.sid} -> {caller_socket_id}")
            emit(
                "call_accepted",
                {"responder_socket_id": request.sid},
                room=caller_socket_id,
            )
        else:
            emit("error", {"message": "Звонящий отключился"})

    def on_call_group(self, payload):
        group_id = payload.get("group_id")
        offer_sdp = payload.get("offer")
        if not group_id:
            emit("error", {"message": "Missing group_id"})
            return

        sender_id, sender = self._get_sender()
        if not sender_id:
            emit("error", {"message": "Unauthorized"})
            return

        participants = self.broker.repo.get_group_participants(group_id)
        if str(sender_id) not in [str(p) for p in participants]:
            emit("error", {"message": "Access denied"})
            return

        online_participants = []
        for pid in participants:
            if str(pid) == str(sender_id):
                continue
            pid_socket = self.broker.get_user_socket(pid)
            if pid_socket and self.broker.resolve_recipient(pid_socket):
                online_participants.append(
                    {"user_id": pid, "socket_id": pid_socket}
                )

        call_id = str(uuid.uuid4())
        self.group_calls[call_id] = {
            "group_id": group_id,
            "caller_socket_id": request.sid,
            "caller_user_id": sender_id,
            "participants": [p["user_id"] for p in online_participants],
            "joined": set(),
        }

        incoming_payload = {
            "call_id": call_id,
            "group_id": group_id,
            "caller_socket_id": request.sid,
            "participants": online_participants,
        }
        if sender:
            incoming_payload["caller_user_id"] = sender.get("id")
            incoming_payload["caller_username"] = sender.get("username")
            if sender.get("avatar_url"):
                incoming_payload["caller_avatar_url"] = sender.get(
                    "avatar_url")
        if offer_sdp:
            incoming_payload["offer"] = offer_sdp

        for p in online_participants:
            emit("incoming_group_call", incoming_payload, room=p["socket_id"])

        emit(
            "group_call_started",
            {
                "call_id": call_id,
                "group_id": group_id,
                "participants": online_participants,
            },
        )

    def on_group_call_answer(self, payload):
        call_id = payload.get("call_id")
        if not call_id:
            emit("error", {"message": "Missing call_id"})
            return

        call = self.group_calls.get(call_id)
        if not call:
            emit("error", {"message": "Call not found"})
            return

        sender_id, _sender = self._get_sender()
        if not sender_id:
            emit("error", {"message": "Unauthorized"})
            return

        participants = self.broker.repo.get_group_participants(
            call["group_id"])
        if str(sender_id) not in [str(p) for p in participants]:
            emit("error", {"message": "Access denied"})
            return

        call["joined"].add(str(sender_id))
        participants_list = call.get("participants", [])
        if str(sender_id) not in [str(p) for p in participants_list]:
            participants_list.append(sender_id)
            call["participants"] = participants_list

        caller_socket_id = call.get("caller_socket_id")
        if caller_socket_id and self.broker.resolve_recipient(caller_socket_id):
            emit(
                "group_call_accepted",
                {
                    "call_id": call_id,
                    "responder_socket_id": request.sid,
                    "responder_user_id": sender_id,
                },
                room=caller_socket_id,
            )

        notify_payload = {
            "call_id": call_id,
            "user_id": sender_id,
            "socket_id": request.sid,
        }
        if caller_socket_id and self.broker.resolve_recipient(caller_socket_id):
            emit("group_call_participant_joined",
                 notify_payload, room=caller_socket_id)
        for pid in call.get("participants", []):
            if str(pid) == str(sender_id):
                continue
            pid_socket = self.broker.get_user_socket(pid)
            if pid_socket and self.broker.resolve_recipient(pid_socket):
                emit("group_call_participant_joined",
                     notify_payload, room=pid_socket)

        for pid in call.get("participants", []):
            if str(pid) == str(sender_id):
                continue
            pid_socket = self.broker.get_user_socket(pid)
            if pid_socket and self.broker.resolve_recipient(pid_socket):
                emit(
                    "group_call_participant_joined",
                    {
                        "call_id": call_id,
                        "user_id": pid,
                        "socket_id": pid_socket,
                    },
                    room=request.sid,
                )

    def on_group_call_reject(self, payload):
        call_id = payload.get("call_id")
        reason = payload.get("reason", "busy")
        if not call_id:
            return

        call = self.group_calls.get(call_id)
        if not call:
            return

        sender_id, _sender = self._get_sender()
        if not sender_id:
            return

        caller_socket_id = call.get("caller_socket_id")
        if caller_socket_id and self.broker.resolve_recipient(caller_socket_id):
            emit(
                "group_call_rejected",
                {
                    "call_id": call_id,
                    "responder_socket_id": request.sid,
                    "responder_user_id": sender_id,
                    "reason": reason,
                },
                room=caller_socket_id,
            )

    def on_group_call_end(self, payload):
        call_id = payload.get("call_id")
        if not call_id:
            return

        call = self.group_calls.get(call_id)
        if not call:
            return

        payload_out = {"call_id": call_id, "sender_socket_id": request.sid}
        caller_socket_id = call.get("caller_socket_id")
        if caller_socket_id and self.broker.resolve_recipient(caller_socket_id):
            emit("group_call_ended", payload_out, room=caller_socket_id)
        for pid in call.get("participants", []):
            pid_socket = self.broker.get_user_socket(pid)
            if pid_socket and self.broker.resolve_recipient(pid_socket):
                emit("group_call_ended", payload_out, room=pid_socket)

        self.group_calls.pop(call_id, None)

    def on_get_group_history(self, payload):
        group_id = payload.get("group_id")
        limit = payload.get("limit", 50)
        offset = payload.get("offset", 0)

        if not group_id:
            emit("error", {"message": "Missing group_id"})
            return

        sender_id = session.get("user_id")
        if not sender_id:
            sender = self.broker.resolve_recipient(request.sid)
            if sender:
                sender_id = sender["id"]

        if not sender_id:
            emit("error", {"message": "Unauthorized"})
            return

        participants = self.broker.repo.get_group_participants(group_id)
        if str(sender_id) not in [str(p) for p in participants]:
            emit("error", {"message": "Access denied"})
            return

        messages = self.broker.repo.get_group_history(group_id, limit, offset)
        emit("group_history", {
            "group_id": group_id,
            "messages": messages
        })

    def on_get_history(self, payload):
        target_id = payload.get("target_id")
        limit = payload.get("limit", 50)
        offset = payload.get("offset", 0)

        if not target_id:
            emit("error", {"message": "Missing target_id"})
            return

        sender_id = session.get("user_id")
        if not sender_id:
            sender = self.broker.resolve_recipient(request.sid)
            if sender:
                sender_id = sender["id"]

        if not sender_id:
            emit("error", {"message": "Unauthorized"})
            return

        messages = self.broker.repo.get_messages_history(
            sender_id, target_id, limit, offset)
        emit("history", {
            "target_id": target_id,
            "messages": messages
        })

    def on_call_reject(self, payload):
        caller_socket_id = payload.get("caller_socket_id")
        if not caller_socket_id:
            return
        if self.broker.resolve_recipient(caller_socket_id):
            logger.info(
                f"Звонок отклонен: {request.sid} -> {caller_socket_id}")
            emit(
                "call_rejected",
                {"responder_socket_id": request.sid, "reason": "busy"},
                room=caller_socket_id,
            )

    def on_call_end(self, payload):
        target_socket_id = payload.get("target_socket_id")
        if not target_socket_id:
            return
        if self.broker.resolve_recipient(target_socket_id):
            logger.info(
                f"Завершение звонка: {request.sid} -> {target_socket_id}")
            emit("call_ended", {
                 "sender_socket_id": request.sid}, room=target_socket_id)

    def on_offer(self, payload):
        target_sid = payload.get("target_socket_id")
        offer_sdp = payload.get("offer")
        if not target_sid or not offer_sdp:
            return
        if self.broker.resolve_recipient(target_sid):
            logger.info(f"Пересылка OFFER: {request.sid} -> {target_sid}")
            emit(
                "offer",
                {"offer": offer_sdp, "sender_socket_id": request.sid},
                room=target_sid,
            )
        else:
            emit("error", {"message": "Пользователь не найден или оффлайн"})

    def on_answer(self, payload):
        target_sid = payload.get("target_socket_id")
        answer_sdp = payload.get("answer")
        if not target_sid or not answer_sdp:
            return
        if self.broker.resolve_recipient(target_sid):
            logger.info(f"Пересылка ANSWER: {request.sid} -> {target_sid}")
            emit(
                "answer",
                {"answer": answer_sdp, "sender_socket_id": request.sid},
                room=target_sid,
            )
        else:
            emit("error", {"message": "Пользователь не найден или оффлайн"})

    def on_ice(self, payload):
        target_sid = payload.get("target_socket_id")
        candidate_data = payload.get("candidate")
        if not target_sid or not candidate_data:
            return
        if self.broker.resolve_recipient(target_sid):
            emit(
                "ice_candidate",
                {"candidate": candidate_data, "sender_socket_id": request.sid},
                room=target_sid,
            )

    def on_send_message(self, payload):
        target_user_id = payload.get("target_user_id")
        channel_id = payload.get("channel_id")
        group_id = payload.get("group_id")
        reply_to = payload.get("reply_to")
        content = payload.get("content")
        attachments = payload.get("attachments")
        msg_type = payload.get("type", "text")

        logger.info(
            f"Получен запрос send_message от {request.sid}. Target: {target_user_id}, Channel: {channel_id}, Group: {group_id}, Content: {content[:50] if content else 'None'}..., Type: {msg_type}")
        logger.info(f"Full payload keys: {list(payload.keys())}")

        if attachments is not None and not isinstance(attachments, list) and not isinstance(attachments, str):
            logger.error(f"Invalid attachments format: {type(attachments)}")
            emit("error", {"message": "attachments must be a list"})
            return

        if not content and not attachments:
            logger.error("Content or attachments is required")
            emit("error", {"message": "Content or attachments is required"})
            return

        if not content:
            content = ""

        if not target_user_id and not channel_id and not group_id:
            logger.error("Missing target_user_id, channel_id or group_id")
            emit(
                "error", {"message": "Missing target_user_id, channel_id or group_id"})
            return

        sender_id = session.get("user_id")
        logger.info(f"Session user_id: {sender_id}")

        if not sender_id:
            sender = self.broker.resolve_recipient(request.sid)
            if sender:
                sender_id = sender["id"]
                logger.info(f"Resolved sender from broker: {sender_id}")
            else:
                logger.warning(
                    f"Failed to resolve sender from broker for SID {request.sid}")

        if not sender_id:
            logger.warning(
                f"send_message: Unauthorized. Sender not found for SID {request.sid}")
            emit("error", {"message": "Unauthorized"})
            return

        logger.info(f"Sender identified: {sender_id}")

        message_id = str(uuid.uuid4())
        timestamp = datetime.utcnow().isoformat()

        if channel_id:
            participants = self.broker.repo.get_channel_participants(
                channel_id)
            if not participants:
                owner_id = self.broker.repo.get_channel_owner(channel_id)
                if not owner_id:
                    emit("error", {"message": "Channel not found"})
                    return
                participants = [owner_id]

            if str(sender_id) not in [str(p) for p in participants]:
                emit(
                    "error", {"message": "You are not a participant of this channel"})
                return

            msg_data = {
                "id": message_id,
                "sender_id": sender_id,
                "channel_id": channel_id,
                "reply_to": reply_to,
                "content": content,
                "attachments": attachments,
                "type": msg_type,
                "timestamp": timestamp
            }

            saved, error = self.broker.repo.save_message(msg_data)
            if not saved:
                logger.error(
                    f"Не удалось сохранить сообщение канала {message_id}: {error}")
                emit("error", {"message": f"Failed to save message: {error}"})
                return

            logger.info(
                f"Сообщение канала {message_id} сохранено (channel={channel_id})")

            participants = self.broker.repo.get_channel_participants(
                channel_id)
            full_message_payload = {
                "id": message_id,
                "sender_id": sender_id,
                "channel_id": channel_id,
                "reply_to": reply_to,
                "content": content,
                "attachments": attachments,
                "type": msg_type,
                "timestamp": timestamp,
                "is_read": 0
            }

            emit("message_sent", {
                "status": "delivered",
                "message": full_message_payload
            })

            for pid in participants:
                if str(pid) == str(sender_id):
                    continue
                pid_socket = self.broker.get_user_socket(pid)
                if pid_socket:
                    emit("receive_message", full_message_payload, room=pid_socket)

        elif group_id:
            participants = self.broker.repo.get_group_participants(group_id)

            if str(sender_id) not in [str(p) for p in participants]:
                emit(
                    "error", {"message": "You are not a participant of this group"})
                return

            msg_data = {
                "id": message_id,
                "sender_id": sender_id,
                "group_id": group_id,
                "reply_to": reply_to,
                "content": content,
                "attachments": attachments,
                "type": msg_type,
                "timestamp": timestamp
            }

            saved, error = self.broker.repo.save_message(msg_data)
            if not saved:
                logger.error(
                    f"Не удалось сохранить сообщение группы {message_id}: {error}")
                emit("error", {"message": f"Failed to save message: {error}"})
                return

            logger.info(
                f"Сообщение группы {message_id} сохранено (group={group_id})")

            full_message_payload = {
                "id": message_id,
                "sender_id": sender_id,
                "group_id": group_id,
                "reply_to": reply_to,
                "content": content,
                "attachments": attachments,
                "type": msg_type,
                "timestamp": timestamp,
                "is_read": 0
            }

            emit("message_sent", {
                "status": "delivered",
                "message": full_message_payload
            })

            for pid in participants:
                if str(pid) == str(sender_id):
                    continue
                pid_socket = self.broker.get_user_socket(pid)
                if pid_socket:
                    emit("receive_message", full_message_payload, room=pid_socket)

        else:
            msg_data = {
                "id": message_id,
                "sender_id": sender_id,
                "target_id": target_user_id,
                "reply_to": reply_to,
                "content": content,
                "attachments": attachments,
                "type": msg_type,
                "timestamp": timestamp
            }

            saved, error = self.broker.repo.save_message(msg_data)
            if not saved:
                logger.error(
                    f"Не удалось сохранить сообщение {message_id}: {error}")
                emit("error", {"message": f"Failed to save message: {error}"})
                return

            logger.info(
                f"Сообщение {message_id} сохранено в БД (sender={sender_id}, target={target_user_id})")

            target_socket = self.broker.get_user_socket(target_user_id)

            full_message_payload = {
                "id": message_id,
                "sender_id": sender_id,
                "target_id": target_user_id,
                "reply_to": reply_to,
                "content": content,
                "attachments": attachments,
                "type": msg_type,
                "timestamp": timestamp,
                "is_read": 0
            }

            if target_socket:
                logger.info(
                    f"Доставка сообщения {message_id} пользователю {target_user_id} (socket={target_socket})")
                emit(
                    "receive_message",
                    full_message_payload,
                    room=target_socket,
                )
                emit("message_sent", {
                    "status": "delivered",
                    "message": full_message_payload
                })
            else:
                logger.info(
                    f"Пользователь {target_user_id} офлайн. Сообщение {message_id} сохранено.")
                emit("message_sent", {
                    "status": "saved",
                    "message": full_message_payload
                })

            try:
                import requests

                backend_url = f"{Config.BACKEND_INTERNAL_URL}/api/v1/users/internal/process_message"
                logger.info(
                    "AI notify backend_url=%s message_id=%s target_id=%s",
                    backend_url,
                    message_id,
                    target_user_id,
                )
                requests.post(backend_url, json={
                    "message_id": message_id,
                    "sender_id": sender_id,
                    "target_id": target_user_id,
                    "content": content,
                    "type": msg_type
                }, timeout=1)
            except Exception as e:
                logger.error(f"Error notifying backend about AI DM: {e}")

    def on_delete_message(self, payload):
        message_id = payload.get("message_id") if isinstance(
            payload, dict) else None
        if not message_id:
            emit("error", {"message": "message_id is required"})
            return

        sender_id, _ = self._get_sender()
        if not sender_id:
            emit("error", {"message": "Unauthorized"})
            return

        meta = self.broker.repo.get_message_meta(message_id)
        if not meta:
            emit("error", {"message": "Message not found"})
            return

        ok, reason = self.broker.repo.mark_message_deleted(
            message_id, sender_id)
        if not ok:
            if reason == "forbidden":
                emit("error", {"message": "Forbidden"})
            elif reason == "not_found":
                emit("error", {"message": "Message not found"})
            else:
                emit("error", {"message": "Failed to delete message"})
            return

        payload = {
            "id": message_id,
            "is_deleted": True,
            "content": "Сообщение удалено",
            "attachments": [],
        }

        if meta.get("channel_id"):
            participants = self.broker.repo.get_channel_participants(
                meta["channel_id"])
            for pid in participants:
                emit("message_deleted", payload, room=pid)
            return

        if meta.get("group_id"):
            participants = self.broker.repo.get_group_participants(
                meta["group_id"])
            for pid in participants:
                emit("message_deleted", payload, room=pid)
            return

        target_user_id = meta.get("target_id")
        emit("message_deleted", payload, room=sender_id)
        if target_user_id:
            emit("message_deleted", payload, room=target_user_id)

    def on_post_create(self, payload):
        if not isinstance(payload, dict):
            emit("error", {"message": "Invalid payload"})
            return
        post_id = payload.get("id")
        posted_by = payload.get("posted_by")
        if not post_id or not posted_by:
            emit("error", {"message": "id and posted_by are required"})
            return
        emit("post_created", payload, broadcast=True)

    def on_post_update(self, payload):
        if not isinstance(payload, dict):
            emit("error", {"message": "Invalid payload"})
            return
        post_id = payload.get("id")
        if not post_id:
            emit("error", {"message": "id is required"})
            return
        emit("post_updated", payload, broadcast=True)

    def on_post_delete(self, payload):
        if not isinstance(payload, dict):
            emit("error", {"message": "Invalid payload"})
            return
        post_id = payload.get("id")
        if not post_id:
            emit("error", {"message": "id is required"})
            return
        emit("post_deleted", {"id": post_id}, broadcast=True)

    def on_video_create(self, payload):
        if not isinstance(payload, dict):
            emit("error", {"message": "Invalid payload"})
            return
        video_id = payload.get("id")
        author_id = payload.get("author_id")
        title = payload.get("title")
        url = payload.get("url")
        if not video_id or not author_id or not title or not url:
            emit("error", {"message": "id, author_id, title, url required"})
            return
        try:
            self.broker.repo.save_video(payload)
        except Exception:
            pass
        emit("video_created", payload, broadcast=True)

    def on_video_update(self, payload):
        if not isinstance(payload, dict):
            emit("error", {"message": "Invalid payload"})
            return
        video_id = payload.get("id")
        if not video_id:
            emit("error", {"message": "id is required"})
            return
        try:
            updates = {k: v for k, v in payload.items() if k != "id"}
            if updates:
                self.broker.repo.update_video(video_id, updates)
        except Exception:
            pass
        emit("video_updated", payload, broadcast=True)

    def on_video_delete(self, payload):
        if not isinstance(payload, dict):
            emit("error", {"message": "Invalid payload"})
            return
        video_id = payload.get("id")
        if not video_id:
            emit("error", {"message": "id is required"})
            return
        try:
            self.broker.repo.delete_video(video_id)
        except Exception:
            pass
        emit("video_deleted", {"id": video_id}, broadcast=True)

    def _get_message_participants(self, meta):
        if not meta:
            return []
        if meta.get("channel_id"):
            participants = self.broker.repo.get_channel_participants(
                meta["channel_id"]
            )
            return participants or []
        if meta.get("group_id"):
            participants = self.broker.repo.get_group_participants(
                meta["group_id"]
            )
            return participants or []
        sender_id = meta.get("sender_id")
        target_id = meta.get("target_id")
        participants = []
        if sender_id:
            participants.append(sender_id)
        if target_id and target_id != sender_id:
            participants.append(target_id)
        return participants

    def on_react_message(self, payload):
        if not isinstance(payload, dict):
            emit("error", {"message": "Invalid payload"})
            return

        message_id = payload.get("message_id")
        emoji = payload.get("emoji")
        if not message_id or not emoji:
            emit(
                "error",
                {"message": "message_id and emoji are required"},
            )
            return

        sender_id, _ = self._get_sender()
        if not sender_id:
            emit("error", {"message": "Unauthorized"})
            return

        meta = self.broker.repo.get_message_meta(message_id)
        if not meta:
            emit("error", {"message": "Message not found"})
            return

        participants = self._get_message_participants(meta)
        if not participants or str(sender_id) not in [
            str(p) for p in participants
        ]:
            emit("error", {"message": "Forbidden"})
            return

        reactions_for_msg = self._message_reactions[message_id]
        users_for_emoji = reactions_for_msg[emoji]

        if sender_id in users_for_emoji:
            users_for_emoji.remove(sender_id)
        else:
            users_for_emoji.add(sender_id)

        if not users_for_emoji:
            reactions_for_msg.pop(emoji, None)
        if not reactions_for_msg:
            self._message_reactions.pop(message_id, None)

        count = len(users_for_emoji)
        event_payload = {
            "id": message_id,
            "emoji": emoji,
            "count": count,
            "sender_id": sender_id,
        }

        for pid in participants:
            emit("message_reaction_update", event_payload, room=pid)

    def on_pin_message(self, payload):
        if not isinstance(payload, dict):
            emit("error", {"message": "Invalid payload"})
            return

        message_id = payload.get("message_id")
        if not message_id:
            emit("error", {"message": "message_id is required"})
            return

        sender_id, _ = self._get_sender()
        if not sender_id:
            emit("error", {"message": "Unauthorized"})
            return

        meta = self.broker.repo.get_message_meta(message_id)
        if not meta:
            emit("error", {"message": "Message not found"})
            return

        participants = self._get_message_participants(meta)
        if not participants or str(sender_id) not in [
            str(p) for p in participants
        ]:
            emit("error", {"message": "Forbidden"})
            return

        if message_id in self._pinned_messages:
            self._pinned_messages.remove(message_id)
            pinned = False
        else:
            self._pinned_messages.add(message_id)
            pinned = True

        event_payload = {
            "id": message_id,
            "pinned": pinned,
        }

        for pid in participants:
            emit("message_pinned", event_payload, room=pid)

    def on_typing(self, payload):
        target_user_id = payload.get("target_user_id")
        if not target_user_id:
            return

        sender_id = session.get("user_id")
        if not sender_id:
            sender = self.broker.resolve_recipient(request.sid)
            if sender:
                sender_id = sender["id"]

        if not sender_id:
            return

        target_socket = self.broker.get_user_socket(target_user_id)
        if target_socket:
            emit("typing", {"sender_id": sender_id}, room=target_socket)

    def on_stop_typing(self, payload):
        target_user_id = payload.get("target_user_id")
        if not target_user_id:
            return

        sender_id = session.get("user_id")
        if not sender_id:
            sender = self.broker.resolve_recipient(request.sid)
            if sender:
                sender_id = sender["id"]

        if not sender_id:
            return

        target_socket = self.broker.get_user_socket(target_user_id)
        if target_socket:
            emit("stop_typing", {"sender_id": sender_id}, room=target_socket)

    def on_message_read(self, payload):
        message_ids = payload.get("message_ids")
        target_sender_id = payload.get("target_sender_id")

        if not message_ids:
            return

        reader_id = session.get("user_id")
        if not reader_id:
            reader = self.broker.resolve_recipient(request.sid)
            if reader:
                reader_id = reader["id"]

        if not reader_id:
            return

        self.broker.repo.mark_messages_as_read(message_ids, reader_id)

        if target_sender_id:
            sender_socket = self.broker.get_user_socket(target_sender_id)
            if sender_socket:
                emit("messages_read_update", {
                    "message_ids": message_ids,
                    "reader_id": reader_id
                }, room=sender_socket)
