"""V2 Bot WebSocket API — real-time bot communication."""
import json
import time
import logging
import threading
from collections import defaultdict
from flask import Blueprint, request, jsonify
from flask_socketio import SocketIO, emit, join_room, leave_room

logger = logging.getLogger(__name__)

# WebSocket state
_bot_connections = {}  # bot_id -> socketio SID
_bot_locks = defaultdict(Lock)

# Global SocketIO instance (set during init)
_socketio = None


def init_bot_websocket(app):
    """Initialize SocketIO for bot WebSocket."""
    global _socketio
    _socketio = SocketIO(
        app,
        cors_allowed_origins="*",
        async_mode="eventlet",
        logger=False,
        engineio_logger=False,
    )

    @_socketio.on("connect")
    def handle_connect():
        """Bot connects with token in query params."""
        token = request.args.get("token", "")
        bot_id = request.args.get("bot_id", "")

        if not token or not bot_id:
            emit("error", {"message": "bot_id and token required"})
            return False

        # Verify bot token
        from app.services.bot_service import BotService
        if not BotService.verify_bot_token(bot_id, token):
            emit("error", {"message": "Invalid token"})
            return False

        join_room(bot_id)
        _bot_connections[bot_id] = request.sid

        logger.info("bot_ws_connected bot_id=%s", bot_id)
        emit("connected", {"bot_id": bot_id, "server_time": int(time.time())})

    @_socketio.on("disconnect")
    def handle_disconnect():
        """Bot disconnects."""
        bot_id = None
        for bid, sid in list(_bot_connections.items()):
            if sid == request.sid:
                bot_id = bid
                break
        if bot_id:
            _bot_connections.pop(bot_id, None)
            leave_room(bot_id)
            logger.info("bot_ws_disconnected bot_id=%s", bot_id)

    @_socketio.on("send_message")
    def handle_send_message(data):
        """Bot sends a message via WebSocket."""
        bot_id = data.get("bot_id", "")
        chat_id = data.get("chat_id", "")
        text = data.get("text", "")
        reply_markup = data.get("reply_markup")
        game = data.get("game")

        if not bot_id or not chat_id:
            emit("error", {"message": "bot_id and chat_id required"})
            return

        # Use existing send endpoint logic
        from app.api.public.v1.bots import _redis_push, _redis_counter_incr
        from app.services.bot_service import BotService

        bot = BotService.get_active_bot_by_id(bot_id)
        if not bot:
            emit("error", {"message": "Bot not found"})
            return

        message_id = _redis_counter_incr("outbox", bot_id)
        message_data = {
            "message_id": str(message_id),
            "chat_id": str(chat_id),
            "text": text or "",
            "date": int(time.time()),
        }
        if reply_markup:
            message_data["reply_markup"] = reply_markup
        if game:
            message_data["game"] = game
            message_data["type"] = "game"

        _redis_push(f"outbox:{bot_id}", message_data)

        emit("message_sent", {
            "ok": True,
            "message_id": str(message_id),
            "chat_id": str(chat_id),
        })

    @_socketio.on("answer_callback")
    def handle_answer_callback(data):
        """Bot answers a callback query."""
        emit("callback_answered", {"ok": True})

    logger.info("Bot WebSocket initialized")


def push_update_to_bot(bot_id, update_data):
    """Push an update to a bot via WebSocket."""
    if _socketio and bot_id in _bot_connections:
        _socketio.emit("update", update_data, room=bot_id)
        return True
    return False


# V2 Bot REST endpoints (fallback for HTTP)
v2_bot_ws_bp = Blueprint("v2_bot_ws", __name__, url_prefix="/api/public/v2/bots")


@v2_bot_ws_bp.route("/<bot_id>/ws/config", methods=["GET"])
def bot_ws_config(bot_id):
    """Return WebSocket configuration for a bot."""
    from app.api.public.v1.bots import _verify_bot_token
    _, error_response = _verify_bot_token(bot_id)
    if error_response:
        return error_response

    from flask import current_app
    ws_url = os.environ.get("BACKEND_WS_URL", "ws://localhost:5050")

    return jsonify({
        "websocket_url": f"{ws_url}/socket.io/?bot_id={bot_id}",
        "protocol": "socket.io",
        "heartbeat_interval": 30,
    }), 200


import os
