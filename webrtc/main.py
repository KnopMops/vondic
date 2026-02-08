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
    CORS(app)
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
| **`call_user`** | Инициация звонка пользователю. | `{ "target_user_id": "UUID" }` |
| **`call_answer`** | Ответ на входящий звонок. | `{ "caller_socket_id": "SOCKET_ID" }` |
| **`call_reject`** | Отклонение входящего звонка. | `{ "caller_socket_id": "SOCKET_ID" }` |
| **`call_end`** | Завершение текущего звонка. | `{ "target_socket_id": "SOCKET_ID" }` |
| **`offer`** | Отправка WebRTC Offer (SDP). | `{ "target_socket_id": "SOCKET_ID", "offer": { ...SDP... } }` |
| **`answer`** | Отправка WebRTC Answer (SDP). | `{ "target_socket_id": "SOCKET_ID", "answer": { ...SDP... } }` |
| **`ice_candidate`** | Отправка ICE кандидата. | `{ "target_socket_id": "SOCKET_ID", "candidate": { ...ICE... } }` |
| **`send_message`** | Отправка текстового сообщения. | `{ "target_user_id": "UUID", "content": "Текст" }` |

---

#### 3. Входящие события (Server -> Client)

| Событие | Описание | Payload (JSON) |
|:---|:---|:---|
| **`receive_message`** | Входящее сообщение. | `{ "sender_id": "UUID", "sender_socket_id": "SOCKET_ID", "content": "Текст", "timestamp": "ISO8601" }` |
| **`connection_success`** | Успешное подключение. | `{ "message": "...", "user_id": "...", "socket_id": "...", "role": "User/Admin" }` |
| **`error`** | Общая ошибка. | `{ "message": "Текст ошибки" }` |
| **`pong_stability`** | Ответ на Ping. | `{ "timestamp": 123456789 }` |
| **`incoming_call`** | Входящий звонок. | `{ "caller_socket_id": "SOCKET_ID" }` |
| **`call_accepted`** | Звонок принят абонентом. | `{ "responder_socket_id": "SOCKET_ID" }` |
| **`call_rejected`** | Звонок отклонен. | `{ "responder_socket_id": "SOCKET_ID", "reason": "busy" }` |
| **`call_ended`** | Звонок завершен собеседником. | `{ "sender_socket_id": "SOCKET_ID" }` |
| **`call_failed`** | Ошибка совершения звонка. | `{ "message": "Причина ошибки" }` |
| **`offer`** | Входящий WebRTC Offer. | `{ "sender_socket_id": "SOCKET_ID", "offer": { ... } }` |
| **`answer`** | Входящий WebRTC Answer. | `{ "sender_socket_id": "SOCKET_ID", "answer": { ... } }` |
| **`ice_candidate`** | Входящий ICE кандидат. | `{ "sender_socket_id": "SOCKET_ID", "candidate": { ... } }` |
""",
            "version": "1.0.0",
        },
    }
    Swagger(app, config=swagger_config)
    socketio = SocketIO(app, cors_allowed_origins="*", async_mode="eventlet")
    user_repo = UserRepository(app.config["DB_PATH"])
    broker = ConnectionBroker(user_repo)
    SignalingService(socketio, broker)

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

    return (app, socketio)


if __name__ == "__main__":
    app, socketio = create_app()
    logger.info(f"Запуск сервера на {app.config['HOST']}:{app.config['PORT']}")
    socketio.run(
        app, host=app.config["HOST"], port=app.config["PORT"], debug=app.config["DEBUG"]
    )
