import logging
import os
import time

from flasgger import Swagger
from flask import Flask, Response, jsonify, request
from flask_cors import CORS
from flask_socketio import SocketIO
from prometheus_client import Counter, Gauge, Histogram, generate_latest

from config import Config
from database import UserRepository
from proxy import ConnectionBroker
from signaling import SignalingService

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

REQUEST_COUNT = Counter(
    "http_requests_total", "Всего HTTP запросов", [
        "method", "endpoint", "status"])
REQUEST_LATENCY = Histogram(
    "http_request_duration_seconds", "Задержка HTTP запросов", [
        "method", "endpoint"])
REQUEST_IN_PROGRESS = Gauge(
    "http_requests_in_progress", "HTTP запросов в процессе", [
        "method", "endpoint"])
WEBSOCKET_CONNECTIONS = Gauge(
    "websocket_connections", "Текущие WebSocket подключения"
)


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
            responses = {"200": {"description": "Успех"}}
            if is_protected:
                responses["401"] = {"description": "Не авторизовано"}
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
        return ({"error": "Пользователь не найден или не в сети"}, 404)

    @app.route("/set_socket_id", methods=["POST"])
    def set_socket_id():
        data = request.get_json()
        if not data:
            return (jsonify({"error": "Данные не предоставлены"}), 400)

        user_id = data.get("user_id")
        socket_id = data.get("socket_id")

        if not user_id or not socket_id:
            return (
                jsonify({"error": "Отсутствует user_id или socket_id"}), 400)

        updated_user = user_repo.update_socket_id_for_user(user_id, socket_id)

        if updated_user:
            return (
                jsonify(
                    {
                        "message": "Сокет пользователя успешно обновлён",
                        "user": updated_user,
                    }
                ),
                200,
            )
        return (
            jsonify({"error": "Пользователь не найден или ошибка базы данных"}), 404)

    @app.route("/messages/history", methods=["POST"])
    def get_messages_history():
        data = request.get_json()
        if not data:
            return jsonify({"error": "Данные не предоставлены"}), 400

        token = data.get("token")
        target_id = data.get("target_id")
        limit = data.get("limit", 50)
        offset = data.get("offset", 0)

        if not token:
            return jsonify({"error": "Требуется токен"}), 401

        user = user_repo.fetch_user_by_token(token)
        if not user:
            return jsonify({"error": "Неверный токен"}), 401

        messages = user_repo.get_messages_history(
            user["id"], target_id, limit, offset)
        return jsonify(messages), 200

    @app.route("/messages/history", methods=["DELETE"])
    def delete_messages_history():
        data = request.get_json()
        if not data:
            return jsonify({"error": "Данные не предоставлены"}), 400

        token = data.get("token")
        target_id = data.get("target_id")

        if not token:
            return jsonify({"error": "Требуется токен"}), 401

        if not target_id:
            return jsonify({"error": "Требуется target_id"}), 400

        user = user_repo.fetch_user_by_token(token)
        if not user:
            return jsonify({"error": "Неверный токен"}), 401

        deleted = user_repo.delete_messages_history(user["id"], target_id)
        return jsonify({"deleted": deleted}), 200

    @app.route("/channels/history", methods=["POST"])
    def get_channel_history():
        data = request.get_json()
        if not data:
            return jsonify({"error": "Данные не предоставлены"}), 400

        token = data.get("token")
        channel_id = data.get("channel_id")
        limit = data.get("limit", 50)
        offset = data.get("offset", 0)

        if not token:
            return jsonify({"error": "Требуется токен"}), 401

        if not channel_id:
            return jsonify({"error": "Требуется channel_id"}), 400

        user = user_repo.fetch_user_by_token(token)
        if not user:
            return jsonify({"error": "Неверный токен"}), 401

        messages = user_repo.get_channel_history(channel_id, limit, offset)
        return jsonify(messages), 200

    @app.route("/channels/history", methods=["DELETE"])
    def delete_channel_history():
        data = request.get_json()
        if not data:
            return jsonify({"error": "Данные не предоставлены"}), 400

        token = data.get("token")
        channel_id = data.get("channel_id")

        if not token:
            return jsonify({"error": "Требуется токен"}), 401

        if not channel_id:
            return jsonify({"error": "Требуется channel_id"}), 400

        user = user_repo.fetch_user_by_token(token)
        if not user:
            return jsonify({"error": "Неверный токен"}), 401

        owner_id = user_repo.get_channel_owner(channel_id)
        if owner_id and str(owner_id) != str(user["id"]):
            return jsonify({"error": "Запрещено"}), 403

        participants = user_repo.get_channel_participants(channel_id)
        if not participants or str(user["id"]) not in [
                str(p) for p in participants]:
            return jsonify({"error": "Доступ запрещён"}), 403

        deleted = user_repo.delete_channel_history(channel_id)
        return jsonify({"deleted": deleted}), 200

    @app.route("/groups/history", methods=["DELETE"])
    def delete_group_history():
        data = request.get_json()
        if not data:
            return jsonify({"error": "Данные не предоставлены"}), 400

        token = data.get("token")
        group_id = data.get("group_id")

        if not token:
            return jsonify({"error": "Требуется токен"}), 401

        if not group_id:
            return jsonify({"error": "Требуется group_id"}), 400

        user = user_repo.fetch_user_by_token(token)
        if not user:
            return jsonify({"error": "Неверный токен"}), 401

        participants = user_repo.get_group_participants(group_id)
        if not participants or str(user["id"]) not in [
                str(p) for p in participants]:
            return jsonify({"error": "Доступ запрещён"}), 403

        owner_id = user_repo.get_group_owner(group_id)
        if owner_id and str(owner_id) != str(user["id"]):
            return jsonify({"error": "Запрещено"}), 403

        deleted = user_repo.delete_group_history(group_id)
        return jsonify({"deleted": deleted}), 200

    @app.route("/chats/search", methods=["POST"])
    def search_chats():
        data = request.get_json()
        if not data:
            return jsonify({"error": "Нет данных"}), 400

        token = data.get("token")
        query = data.get("query")

        if not token:
            return jsonify({"error": "Требуется токен"}), 401

        user = user_repo.fetch_user_by_token(token)
        if not user:
            return jsonify({"error": "Неверный токен"}), 401

        if not query:
            return jsonify([]), 200

        results = user_repo.search_users(query)
        return jsonify(results), 200

    @app.route("/messages/search", methods=["POST"])
    def search_messages():
        data = request.get_json()
        if not data:
            return jsonify({"error": "Нет данных"}), 400

        token = data.get("token")
        target_id = data.get("target_id")
        query = data.get("query")

        if not token:
            return jsonify({"error": "Требуется токен"}), 401

        user = user_repo.fetch_user_by_token(token)
        if not user:
            return jsonify({"error": "Неверный токен"}), 401

        if not target_id or not query:
            return jsonify([]), 200

        results = user_repo.search_messages(user["id"], target_id, query)
        return jsonify(results), 200

    @app.route("/internal/broadcast_message", methods=["POST"])
    def broadcast_message():
        data = request.get_json()
        if not data:
            logger.error("broadcast_message: Данные не предоставлены")
            return jsonify({"error": "Нет данных"}), 400

        group_id = data.get("group_id")
        target_id = data.get("target_id")
        payload = data.get("payload")

        logger.info(
            f"broadcast_message: target_id={target_id}, group_id={group_id}, payload_keys={
                list(
                    payload.keys()) if payload else 'None'}")

        if not payload:
            logger.error("broadcast_message: Отсутствует payload")
            return jsonify({"error": "Отсутствует payload"}), 400

        if group_id:
            participants = user_repo.get_group_participants(group_id)
            logger.info(
                f"broadcast_message: Найдено {
                    len(participants)} участников для группы {group_id}")
            for pid in participants:
                pid_socket = broker.get_user_socket(pid)
                if pid_socket:
                    socketio.emit("receive_message", payload, room=pid_socket)
                else:
                    logger.warning(
                        f"broadcast_message: Сокет не найден для участника {pid}")
        elif target_id:
            target_socket = broker.get_user_socket(target_id)
            if target_socket:
                logger.info(
                    f"broadcast_message: Отправка {target_id} на сокет {target_socket}")
                socketio.emit("receive_message", payload, room=target_socket)
            else:
                logger.warning(
                    f"broadcast_message: Сокет не найден для {target_id}")
        else:
            logger.error(
                "broadcast_message: Отсутствует group_id или target_id")
            return jsonify(
                {"error": "Отсутствует group_id или target_id"}), 400

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
            "description": "API документация для сервера сигнализации WebRTC",
            "version": "1.0.0",
        },
        "paths": _build_swagger_paths(app),
    }
    Swagger(app, config=swagger_config, template=swagger_template)

    @app.before_request
    def before_request_metrics():
        endpoint = request.endpoint or "unknown"
        REQUEST_IN_PROGRESS.labels(
            method=request.method,
            endpoint=endpoint).inc()
        request.start_time = time.time()

    @app.after_request
    def after_request_metrics(response):
        endpoint = request.endpoint or "unknown"
        status = response.status_code
        REQUEST_COUNT.labels(
            method=request.method,
            endpoint=endpoint,
            status=status).inc()
        REQUEST_IN_PROGRESS.labels(
            method=request.method,
            endpoint=endpoint).dec()
        if hasattr(request, 'start_time') and request.start_time:
            latency = time.time() - request.start_time
            REQUEST_LATENCY.labels(
                method=request.method,
                endpoint=endpoint).observe(latency)
        return response

    @app.route("/metrics")
    def metrics():
        return Response(
            generate_latest(),
            mimetype="text/plain; charset=utf-8")

    @socketio.on("connect")
    def on_connect():
        WEBSOCKET_CONNECTIONS.inc()

    @socketio.on("disconnect")
    def on_disconnect():
        WEBSOCKET_CONNECTIONS.dec()

    return (app, socketio)


if __name__ == "__main__":
    app, socketio = create_app()
    logger.info(f"Запуск сервера на {app.config['HOST']}:{app.config['PORT']}")

    socketio.run(
        app,
        host=app.config["HOST"],
        port=app.config["PORT"],
        debug=app.config["DEBUG"],
        allow_unsafe_werkzeug=True,
        use_reloader=False
    )
