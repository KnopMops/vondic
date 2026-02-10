import logging

import eventlet
from flasgger import Swagger
from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_socketio import SocketIO

from .config import Config
from .database import UserRepository
from .proxy import ConnectionBroker
from .signaling import SignalingService

eventlet.monkey_patch()


logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)

    CORS(app, resources={r"/*": {"origins": "*"}}, supports_credentials=True)

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
    }
    Swagger(app, config=swagger_config)
    socketio = SocketIO(
        app,
        cors_allowed_origins="*",
        async_mode="eventlet"
    )
    user_repo = UserRepository()
    # user_repo.init_messages_table() # Initialized in __init__
    logger.info("WebRTC Server initialized. Message encryption enabled.")
    broker = ConnectionBroker(user_repo)
    SignalingService(socketio, broker)

    @app.route("/api/online-users", methods=["GET"])
    def get_online_users():
        """
        Получить количество онлайн пользователей
        ---
        tags:
          - Metrics
        responses:
          200:
            description: Количество онлайн пользователей
            schema:
              type: object
              properties:
                count:
                  type: integer
        """
        count = user_repo.get_online_users_count()
        return jsonify({"count": count}), 200

    @app.route("/")
    def index():
        """
        Статус сервера WebRTC
        ---
        tags:
          - System
        responses:
          200:
            description: Возвращает текстовое сообщение о статусе работы сервера.
            schema:
              type: string
              example: Сервер сигнализации WebRTC запущен.
        """
        return "Сервер сигнализации WebRTC запущен."

    @app.route("/get_socket_id/<user_id>")
    def get_socket_id(user_id):
        """
        Получение socket_id пользователя по user_id
        ---
        tags:
          - Users
        parameters:
          - name: user_id
            in: path
            type: string
            required: true
            description: ID пользователя (UUID)
        responses:
          200:
            description: Socket ID пользователя найден
            schema:
              type: object
              properties:
                socket_id:
                  type: string
                  description: Текущий socket_id пользователя
          404:
            description: Пользователь не найден или не подключен
            schema:
              type: object
              properties:
                error:
                  type: string
        """
        socket_id = broker.get_user_socket(user_id)
        if socket_id:
            return ({"socket_id": socket_id}, 200)
        return ({"error": "User not found or offline"}, 404)

    @app.route("/set_socket_id", methods=["POST"])
    def set_socket_id():
        """
        Принудительное назначение socket_id пользователю
        ---
        tags:
          - Users
        parameters:
          - name: body
            in: body
            required: true
            schema:
              type: object
              required:
                - user_id
                - socket_id
              properties:
                user_id:
                  type: string
                  description: ID пользователя (UUID)
                socket_id:
                  type: string
                  description: Socket ID для привязки
        responses:
          200:
            description: Пользователь успешно обновлен
            schema:
              type: object
              properties:
                message:
                  type: string
                  user:
                    type: object
          400:
            description: Некорректные данные
          404:
            description: Пользователь не найден
        """
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
                    {"message": "User socket updated successfully",
                        "user": updated_user}
                ),
                200,
            )
        return (jsonify({"error": "User not found or database error"}), 404)

    @app.route("/messages/history", methods=["POST"])
    def get_messages_history():
        """
        Получение истории сообщений
        ---
        tags:
          - Messages
        parameters:
          - name: body
            in: body
            required: true
            schema:
              type: object
              required:
                - token
                - target_id
              properties:
                token:
                  type: string
                  description: Токен авторизации пользователя
                target_id:
                  type: string
                  description: ID собеседника (UUID)
                limit:
                  type: integer
                  default: 50
                  description: Лимит сообщений
                offset:
                  type: integer
                  default: 0
                  description: Смещение
        responses:
          200:
            description: История сообщений
            schema:
              type: array
              items:
                type: object
                properties:
                  id:
                    type: string
                  sender_id:
                    type: string
                  target_id:
                    type: string
                  content:
                    type: string
                  timestamp:
                    type: string
          401:
            description: Неавторизован
          400:
            description: Некорректные параметры
        """
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
            user["id"], target_id, limit, offset
        )
        return jsonify(messages), 200

    @app.route("/channels/history", methods=["POST"])
    def get_channel_history():
        """
        Получение истории сообщений канала
        ---
        tags:
          - Channels
        parameters:
          - name: body
            in: body
            required: true
            schema:
              type: object
              required:
                - token
                - channel_id
              properties:
                token:
                  type: string
                  description: Токен авторизации пользователя
                channel_id:
                  type: string
                  description: ID канала (UUID)
                limit:
                  type: integer
                  default: 50
                  description: Лимит сообщений
                offset:
                  type: integer
                  default: 0
                  description: Смещение
        responses:
          200:
            description: История сообщений канала
            schema:
              type: array
              items:
                type: object
                properties:
                  id:
                    type: string
                  sender_id:
                    type: string
                  channel_id:
                    type: string
                  content:
                    type: string
                  timestamp:
                    type: string
          401:
            description: Неавторизован
          400:
            description: Некорректные параметры
        """
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

        # Optional: Check if user is participant of the channel
        # participants = user_repo.get_channel_participants(channel_id)
        # if user["id"] not in participants:
        #     return jsonify({"error": "Access denied"}), 403

        messages = user_repo.get_channel_history(
            channel_id, limit, offset
        )
        return jsonify(messages), 200

    @app.route("/chats/search", methods=["POST"])
    def search_chats():
        """
        Поиск пользователей (чатов)
        ---
        tags:
          - Search
        parameters:
          - name: body
            in: body
            required: true
            schema:
              type: object
              required:
                - token
                - query
              properties:
                token:
                  type: string
                query:
                  type: string
                  description: Часть имени пользователя
        responses:
          200:
            description: Список найденных пользователей
            schema:
              type: array
              items:
                type: object
                properties:
                  id:
                    type: string
                  username:
                    type: string
        """
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
        """
        Поиск сообщений внутри чата
        ---
        tags:
          - Search
        parameters:
          - name: body
            in: body
            required: true
            schema:
              type: object
              required:
                - token
                - target_id
                - query
              properties:
                token:
                  type: string
                target_id:
                  type: string
                query:
                  type: string
        responses:
          200:
            description: Найденные сообщения
        """
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

    return (app, socketio)


if __name__ == "__main__":
    app, socketio = create_app()
    logger.info(f"Запуск сервера на {app.config['HOST']}:{app.config['PORT']}")
    socketio.run(
        app, host=app.config["HOST"], port=app.config["PORT"], debug=app.config["DEBUG"]
    )
