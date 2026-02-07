import logging

from flask import request
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

    def on_connect(self, auth=None):
        token_value = None
        if auth and isinstance(auth, dict):
            token_value = auth.get("token")
        if not token_value:
            token_value = request.args.get("token")
        if not token_value:
            logger.warning("Отклонено: Токен не предоставлен")
            raise ConnectionRefusedError("401 Unauthorized: Токен не предоставлен")
        current_socket = request.sid
        user_info = self.broker.register_session(token_value, current_socket)
        if not user_info:
            logger.warning("Отклонено: Ошибка регистрации сессии")
            raise ConnectionRefusedError("401 Unauthorized: Ошибка регистрации")
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
            emit("incoming_call", {"caller_socket_id": request.sid}, room=target_socket)
        else:
            emit("call_failed", {"message": "Пользователь не в сети или не найден"})

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
            logger.info(f"Звонок отклонен: {request.sid} -> {caller_socket_id}")
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
            logger.info(f"Завершение звонка: {request.sid} -> {target_socket_id}")
            emit("call_ended", {"sender_socket_id": request.sid}, room=target_socket_id)

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
