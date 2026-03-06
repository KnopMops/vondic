import logging
import os

from flasgger import Swagger
from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_socketio import SocketIO

from .config import Config
from .database import UserRepository
from .proxy import ConnectionBroker
from .signaling import SignalingService

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)


def _tag_for_rule(rule: str) -> str:
    if rule.startswith("/messages"):
        return "Messages"
    if rule.startswith("/channels"):
        return "Channels"
    if rule.startswith("/chats"):
        return "Chats"
    if rule.startswith("/api/online-users"):
        return "Stats"
    if rule.startswith("/set_socket_id") or rule.startswith("/get_socket_id"):
        return "Sockets"
    if rule.startswith("/internal"):
        return "Internal"
    if rule == "/":
        return "Root"
    return "Other"


def _build_swagger_paths(app: Flask):
    protected_rules = {
        "/messages/history",
        "/channels/history",
        "/chats/search",
        "/messages/search",
    }
    paths = {}
    for rule in app.url_map.iter_rules():
        if rule.endpoint == "static":
            continue
        if rule.rule.startswith("/flasgger_static"):
            continue
        if rule.rule in ("/apispec.json", "/docs/"):
            continue
        methods = sorted(m for m in rule.methods if m not in {
                         "HEAD", "OPTIONS"})
        if not methods:
            continue
        is_protected = rule.rule in protected_rules
        tags = [_tag_for_rule(rule.rule),
                "Protected" if is_protected else "Public"]
        entry = paths.setdefault(rule.rule, {})
        for method in methods:
            responses = {"200": {"description": "Success"}}
            if is_protected:
                responses["401"] = {"description": "Unauthorized"}
            entry[method.lower()] = {
                "summary": rule.endpoint,
                "tags": tags,
                "responses": responses,
            }
    return paths


def _build_allowed_origins() -> list[str]:
    defaults = [
        "https://vondic.knopusmedia.ru",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5000",
        "http://localhost:1420",
        "http://127.0.0.1:1420",
        "tauri://localhost",
    ]
    raw = os.getenv("CORS_ALLOWED_ORIGINS", "")
    extra = [origin.strip() for origin in raw.split(",") if origin.strip()]
    frontend_url = os.getenv("FRONTEND_URL")
    if frontend_url:
        extra.append(frontend_url)
    merged = []
    seen = set()
    for origin in defaults + extra:
        if origin not in seen:
            merged.append(origin)
            seen.add(origin)
    return merged


def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)

    allowed_origins = _build_allowed_origins()
    CORS(app,
         resources={r"/*": {"origins": allowed_origins}},
         supports_credentials=True)

    socketio = SocketIO(
        app,
        cors_allowed_origins=allowed_origins,
        async_mode="threading",
        logger=True,
        engineio_logger=True,
    )
    user_repo = UserRepository()
    logger.info("WebRTC Server initialized. Message encryption enabled.")
    broker = ConnectionBroker(user_repo)
    SignalingService(socketio, broker)

    @app.route("/api/online-users", methods=["GET"])
    def get_online_users():
        count = user_repo.get_online_users_count()
        return jsonify({"count": count}), 200

    @app.route("/")
    def index():
        return "Сервер сигнализации WebRTC запущен."

    @app.route("/get_socket_id/<user_id>")
    def get_socket_id(user_id):
        socket_id = broker.get_user_socket(user_id)
        if socket_id:
            return ({"socket_id": socket_id}, 200)
        return ({"error": "User not found or offline"}, 404)

    @app.route("/set_socket_id", methods=["POST"])
    def set_socket_id():
        data = request.get_json()
        if not data:
            return (jsonify({"error": "No data provided"}), 400)

        user_id = data.get("user_id")
        socket_id = data.get("socket_id")

        if not user_id or not socket_id:
            return (jsonify({"error": "Missing user_id or socket_id"}), 400)

        updated_user = user_repo.update_socket_id_for_user(user_id, socket_id)

        if updated_user:
            return (
                jsonify(
                    {
                        "message": "User socket updated successfully",
                        "user": updated_user,
                    }
                ),
                200,
            )
        return (jsonify({"error": "User not found or database error"}), 404)

    @app.route("/messages/history", methods=["POST"])
    def get_messages_history():
        data = request.get_json()
        if not data:
            return jsonify({"error": "No data provided"}), 400

        token = data.get("token")
        target_id = data.get("target_id")
        limit = data.get("limit", 50)
        offset = data.get("offset", 0)

        if not token:
            return jsonify({"error": "Token required"}), 401

        user = user_repo.fetch_user_by_token(token)
        if not user:
            return jsonify({"error": "Invalid token"}), 401

        messages = user_repo.get_messages_history(
            user["id"], target_id, limit, offset)
        return jsonify(messages), 200

    @app.route("/messages/history", methods=["DELETE"])
    def delete_messages_history():
        data = request.get_json()
        if not data:
            return jsonify({"error": "No data provided"}), 400

        token = data.get("token")
        target_id = data.get("target_id")

        if not token:
            return jsonify({"error": "Token required"}), 401

        if not target_id:
            return jsonify({"error": "target_id is required"}), 400

        user = user_repo.fetch_user_by_token(token)
        if not user:
            return jsonify({"error": "Invalid token"}), 401

        deleted = user_repo.delete_messages_history(user["id"], target_id)
        return jsonify({"deleted": deleted}), 200

    @app.route("/channels/history", methods=["POST"])
    def get_channel_history():
        data = request.get_json()
        if not data:
            return jsonify({"error": "No data provided"}), 400

        token = data.get("token")
        channel_id = data.get("channel_id")
        limit = data.get("limit", 50)
        offset = data.get("offset", 0)

        if not token:
            return jsonify({"error": "Token required"}), 401

        if not channel_id:
            return jsonify({"error": "channel_id is required"}), 400

        user = user_repo.fetch_user_by_token(token)
        if not user:
            return jsonify({"error": "Invalid token"}), 401

        messages = user_repo.get_channel_history(channel_id, limit, offset)
        return jsonify(messages), 200

    @app.route("/channels/history", methods=["DELETE"])
    def delete_channel_history():
        data = request.get_json()
        if not data:
            return jsonify({"error": "No data provided"}), 400

        token = data.get("token")
        channel_id = data.get("channel_id")

        if not token:
            return jsonify({"error": "Token required"}), 401

        if not channel_id:
            return jsonify({"error": "channel_id is required"}), 400

        user = user_repo.fetch_user_by_token(token)
        if not user:
            return jsonify({"error": "Invalid token"}), 401

        owner_id = user_repo.get_channel_owner(channel_id)
        if owner_id and str(owner_id) != str(user["id"]):
            return jsonify({"error": "Forbidden"}), 403

        participants = user_repo.get_channel_participants(channel_id)
        if not participants or str(user["id"]) not in [
                str(p) for p in participants]:
            return jsonify({"error": "Access denied"}), 403

        deleted = user_repo.delete_channel_history(channel_id)
        return jsonify({"deleted": deleted}), 200

    @app.route("/groups/history", methods=["DELETE"])
    def delete_group_history():
        data = request.get_json()
        if not data:
            return jsonify({"error": "No data provided"}), 400

        token = data.get("token")
        group_id = data.get("group_id")

        if not token:
            return jsonify({"error": "Token required"}), 401

        if not group_id:
            return jsonify({"error": "group_id is required"}), 400

        user = user_repo.fetch_user_by_token(token)
        if not user:
            return jsonify({"error": "Invalid token"}), 401

        participants = user_repo.get_group_participants(group_id)
        if not participants or str(user["id"]) not in [
                str(p) for p in participants]:
            return jsonify({"error": "Access denied"}), 403

        owner_id = user_repo.get_group_owner(group_id)
        if owner_id and str(owner_id) != str(user["id"]):
            return jsonify({"error": "Forbidden"}), 403

        deleted = user_repo.delete_group_history(group_id)
        return jsonify({"deleted": deleted}), 200

    @app.route("/chats/search", methods=["POST"])
    def search_chats():
        data = request.get_json()
        if not data:
            return jsonify({"error": "No data"}), 400

        token = data.get("token")
        query = data.get("query")

        if not token:
            return jsonify({"error": "Token required"}), 401

        user = user_repo.fetch_user_by_token(token)
        if not user:
            return jsonify({"error": "Invalid token"}), 401

        if not query:
            return jsonify([]), 200

        results = user_repo.search_users(query)
        return jsonify(results), 200

    @app.route("/messages/search", methods=["POST"])
    def search_messages():
        data = request.get_json()
        if not data:
            return jsonify({"error": "No data"}), 400

        token = data.get("token")
        target_id = data.get("target_id")
        query = data.get("query")

        if not token:
            return jsonify({"error": "Token required"}), 401

        user = user_repo.fetch_user_by_token(token)
        if not user:
            return jsonify({"error": "Invalid token"}), 401

        if not target_id or not query:
            return jsonify([]), 200

        results = user_repo.search_messages(user["id"], target_id, query)
        return jsonify(results), 200

    @app.route("/internal/broadcast_message", methods=["POST"])
    def broadcast_message():
        data = request.get_json()
        if not data:
            logger.error("broadcast_message: No data provided")
            return jsonify({"error": "No data"}), 400

        group_id = data.get("group_id")
        target_id = data.get("target_id")
        payload = data.get("payload")

        logger.info(
            f"broadcast_message: target_id={target_id}, group_id={group_id}, payload_keys={
                list(
                    payload.keys()) if payload else 'None'}")

        if not payload:
            logger.error("broadcast_message: Missing payload")
            return jsonify({"error": "Missing payload"}), 400

        if group_id:
            participants = user_repo.get_group_participants(group_id)
            logger.info(
                f"broadcast_message: Found {
                    len(participants)} participants for group {group_id}")
            for pid in participants:
                pid_socket = broker.get_user_socket(pid)
                if pid_socket:
                    socketio.emit("receive_message", payload, room=pid_socket)
                else:
                    logger.warning(
                        f"broadcast_message: No socket found for participant {pid}")
        elif target_id:
            target_socket = broker.get_user_socket(target_id)
            if target_socket:
                logger.info(
                    f"broadcast_message: Sending to target {target_id} on socket {target_socket}")
                socketio.emit("receive_message", payload, room=target_socket)
            else:
                logger.warning(
                    f"broadcast_message: No socket found for target {target_id}")
        else:
            logger.error("broadcast_message: Missing group_id or target_id")
            return jsonify({"error": "Missing group_id or target_id"}), 400

        return jsonify({"status": "success"}), 200

    swagger_config = {
        "headers": [],
        "specs": [
            {
                "endpoint": "apispec",
                "route": "/apispec.json",
                "rule_filter": lambda rule: True,
                "model_filter": lambda tag: True,
            }
        ],
        "static_url_path": "/flasgger_static",
        "swagger_ui": True,
        "specs_route": "/docs/",
    }
    swagger_template = {
        "swagger": "2.0",
        "info": {
            "title": "WebRTC Signaling Server API",
            "description": """
### Документация WebSocket событий

Этот сервер использует **Socket.IO** для сигнализации WebRTC и управления звонками.
Подключение осуществляется по стандартному протоколу Socket.IO.

---

#### 1. Аутентификация
Для подключения необходимо передать `token` либо в query-параметрах, либо в auth-объекте.

**Пример (JS Client):**
```javascript
const socket = io("http://localhost:5000", {
  auth: { token: "YOUR_ACCESS_TOKEN" }
  // или query: { token: "YOUR_ACCESS_TOKEN" }
});
```

---

#### 2. Исходящие события (Client -> Server)

| Событие | Описание | Payload (JSON) |
|:---|:---|:---|
| **`ping_stability`** | Проверка связи (Ping). | `{ "timestamp": 123456789 }` |
| **`call_user`** | Инициация звонка пользователю. | `{ "target_user_id": "UUID", "offer": { ...SDP... } }` |
| **`call_answer`** | Ответ на входящий звонок. | `{ "caller_socket_id": "SOCKET_ID" }` |
| **`call_reject`** | Отклонение входящего звонка. | `{ "caller_socket_id": "SOCKET_ID" }` |
| **`call_end`** | Завершение текущего звонка. | `{ "target_socket_id": "SOCKET_ID" }` |
| **`call_group`** | Инициация группового звонка. | `{ "group_id": "UUID", "offer": { ...SDP... } }` |
| **`group_call_answer`** | Принять групповой звонок. | `{ "call_id": "UUID" }` |
| **`group_call_reject`** | Отклонить групповой звонок. | `{ "call_id": "UUID", "reason": "busy" }` |
| **`group_call_end`** | Завершить групповой звонок. | `{ "call_id": "UUID" }` |
| **`offer`** | Отправка WebRTC Offer (SDP). | `{ "target_socket_id": "SOCKET_ID", "offer": { ...SDP... } }` |
| **`answer`** | Отправка WebRTC Answer (SDP). | `{ "target_socket_id": "SOCKET_ID", "answer": { ...SDP... } }` |
| **`ice_candidate`** | Отправка ICE кандидата. | `{ "target_socket_id": "SOCKET_ID", "candidate": { ...ICE... } }` |
| **`send_message`** | Отправка сообщения (текст/вложения). | `{ "target_user_id": "UUID", "group_id": "UUID", "channel_id": "UUID", "content": "Текст", "attachments": [ ... ], "type": "text" }` |
| **`get_group_history`** | Запрос истории сообщений группы. | `{ "group_id": "UUID", "limit": 50, "offset": 0 }` |

---

#### 3. Входящие события (Server -> Client)

| Событие | Описание | Payload (JSON) |
|:---|:---|:---|
| **`receive_message`** | Входящее сообщение. | `{ "id": "...", "sender_id": "UUID", "content": "Текст", "attachments": [ ... ], "timestamp": "ISO8601" }` |
| **`group_history`** | История сообщений группы. | `{ "group_id": "UUID", "messages": [ ... ] }` |
| **`connection_success`** | Успешное подключение. | `{ "message": "...", "user_id": "...", "socket_id": "...", "role": "User/Admin" }` |
| **`error`** | Общая ошибка. | `{ "message": "Текст ошибки" }` |
| **`pong_stability`** | Ответ на Ping. | `{ "timestamp": 123456789 }` |
| **`incoming_call`** | Входящий звонок. | `{ "caller_socket_id": "SOCKET_ID", "caller_user_id": "UUID", "caller_username": "name", "caller_avatar_url": "...", "offer": { ...SDP... } }` |
| **`incoming_group_call`** | Входящий групповой звонок. | `{ "call_id": "UUID", "group_id": "UUID", "caller_socket_id": "SOCKET_ID", "caller_user_id": "UUID", "caller_username": "name", "caller_avatar_url": "...", "participants": [ { "user_id": "...", "socket_id": "..." } ], "offer": { ...SDP... } }` |
| **`call_accepted`** | Звонок принят абонентом. | `{ "responder_socket_id": "SOCKET_ID" }` |
| **`call_rejected`** | Звонок отклонен. | `{ "responder_socket_id": "SOCKET_ID", "reason": "busy" }` |
| **`call_ended`** | Звонок завершен собеседником. | `{ "sender_socket_id": "SOCKET_ID" }` |
| **`call_failed`** | Ошибка совершения звонка. | `{ "message": "Причина ошибки" }` |
| **`group_call_started`** | Групповой звонок инициирован. | `{ "call_id": "UUID", "group_id": "UUID", "participants": [ { "user_id": "...", "socket_id": "..." } ] }` |
| **`group_call_accepted`** | Участник принял групповой звонок. | `{ "call_id": "UUID", "responder_socket_id": "SOCKET_ID", "responder_user_id": "UUID" }` |
| **`group_call_rejected`** | Участник отклонил групповой звонок. | `{ "call_id": "UUID", "responder_socket_id": "SOCKET_ID", "responder_user_id": "UUID", "reason": "busy" }` |
| **`group_call_participant_joined`** | Участник присоединился к групповому звонку. | `{ "call_id": "UUID", "user_id": "UUID", "socket_id": "SOCKET_ID" }` |
| **`group_call_ended`** | Групповой звонок завершен. | `{ "call_id": "UUID", "sender_socket_id": "SOCKET_ID" }` |
| **`offer`** | Входящий WebRTC Offer. | `{ "sender_socket_id": "SOCKET_ID", "offer": { ... } }` |
| **`answer`** | Входящий WebRTC Answer. | `{ "sender_socket_id": "SOCKET_ID", "answer": { ... } }` |
| **`ice_candidate`** | Входящий ICE кандидат. | `{ "sender_socket_id": "SOCKET_ID", "candidate": { ... } }` |
| **`message_sent`** | Подтверждение отправки сообщения. | `{ "status": "delivered|saved", "message": { "id": "...", "content": "...", "attachments": [ ... ] } }` |
""",
            "version": "1.0.0",
        },
        "paths": _build_swagger_paths(app),
    }
    Swagger(app, config=swagger_config, template=swagger_template)

    return (app, socketio)


if __name__ == "__main__":
    app, socketio = create_app()
    logger.info(f"Запуск сервера на {app.config['HOST']}:{app.config['PORT']}")
    
    socketio.run(
        app,
        host=app.config["HOST"],
        port=app.config["PORT"],
        debug=app.config["DEBUG"],
        allow_unsafe_werkzeug=True
    )
