import logging
import uuid
from datetime import datetime
from flask import request, session
from flask_socketio import ConnectionRefusedError, emit, join_room
from .proxy import ConnectionBroker

logger = logging.getLogger(__name__)


class SignalingService:
    def __init__(self, socket_server, broker: ConnectionBroker):
        self.io = socket_server
        self.broker = broker
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
        self.io.on_event("send_message", self.on_send_message)
        self.io.on_event("typing", self.on_typing)
        self.io.on_event("stop_typing", self.on_stop_typing)
        self.io.on_event("message_read", self.on_message_read)

    def on_connect(self, auth=None):
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

    def on_call_user(self, payload):
        target_user_id = payload.get("target_user_id")
        if not target_user_id:
            emit("error", {"message": "Не указан target_user_id"})
            return
        target_socket = self.broker.get_user_socket(target_user_id)
        if target_socket and self.broker.resolve_recipient(target_socket):
            logger.info(
                f"Звонок от {request.sid} к пользователю {target_user_id} (socket: {target_socket})"
            )
            emit("incoming_call", {
                 "caller_socket_id": request.sid}, room=target_socket)
        else:
            emit("call_failed", {
                 "message": "Пользователь не в сети или не найден"})

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
        content = payload.get("content")

        logger.info(
            f"Получен запрос send_message от {request.sid}. Target: {target_user_id}, Channel: {channel_id}, Content: {content[:50] if content else 'None'}...")

        if not content:
            emit("error", {"message": "Content is required"})
            return

        if not target_user_id and not channel_id:
            emit("error", {"message": "Missing target_user_id or channel_id"})
            return

        sender_id = session.get("user_id")
        if not sender_id:
            sender = self.broker.resolve_recipient(request.sid)
            if sender:
                sender_id = sender["id"]

        if not sender_id:
            logger.warning(
                f"send_message: Unauthorized. Sender not found for SID {request.sid}")
            emit("error", {"message": "Unauthorized"})
            return

        logger.info(f"Sender identified: {sender_id}")

        message_id = str(uuid.uuid4())
        timestamp = datetime.utcnow().isoformat()

        if channel_id:
            # Channel Message Logic
            owner_id = self.broker.repo.get_channel_owner(channel_id)
            if not owner_id:
                emit("error", {"message": "Channel not found"})
                return

            if str(sender_id) != str(owner_id):
                emit("error", {"message": "Only the owner can write in this channel"})
                return

            msg_data = {
                "id": message_id,
                "sender_id": sender_id,
                "channel_id": channel_id,
                "content": content,
                "timestamp": timestamp
            }

            saved = self.broker.repo.save_message(msg_data)
            if not saved:
                logger.error(f"Не удалось сохранить сообщение канала {message_id}")
                emit("error", {"message": "Failed to save message"})
                return

            logger.info(f"Сообщение канала {message_id} сохранено (channel={channel_id})")

            # Broadcast to participants
            participants = self.broker.repo.get_channel_participants(channel_id)
            full_message_payload = {
                "id": message_id,
                "sender_id": sender_id,
                "channel_id": channel_id,
                "content": content,
                "timestamp": timestamp,
                "is_read": 0
            }

            # Emit confirmation to sender
            emit("message_sent", {
                "status": "delivered",
                "message": full_message_payload
            })

            # Emit to other participants
            for pid in participants:
                if str(pid) == str(sender_id):
                    continue
                pid_socket = self.broker.get_user_socket(pid)
                if pid_socket:
                    emit("receive_message", full_message_payload, room=pid_socket)

        else:
            # Direct Message Logic
            msg_data = {
                "id": message_id,
                "sender_id": sender_id,
                "target_id": target_user_id,
                "content": content,
                "timestamp": timestamp
            }

            saved = self.broker.repo.save_message(msg_data)
            if not saved:
                logger.error(f"Не удалось сохранить сообщение {message_id}")
                emit("error", {"message": "Failed to save message"})
                return

            logger.info(
                f"Сообщение {message_id} сохранено в БД (sender={sender_id}, target={target_user_id})")

            target_socket = self.broker.get_user_socket(target_user_id)

            full_message_payload = {
                "id": message_id,
                "sender_id": sender_id,
                "target_id": target_user_id,
                "content": content,
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
        """
        Обработка события прочтения сообщений.
        payload = {
            "message_ids": ["uuid1", "uuid2"],
            "sender_id": "id-of-original-sender" (опционально, чтобы быстрее найти сокет, но лучше искать по message_id или передавать sender_id с клиента)
        }
        В данном случае мы ожидаем, что клиент знает sender_id (того, кто отправил эти сообщения),
        чтобы мы могли уведомить его, что его сообщения прочитаны.
        """
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
