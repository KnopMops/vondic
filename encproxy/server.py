"""
EncProxy Server — Encryption relay for Vondic.

A lightweight WebSocket relay that forwards encrypted messages between
clients. The server NEVER sees plaintext — all encryption/decryption
happens client-side.

Run standalone:
    python -m encproxy

Run with custom config:
    PORT=5100 BACKEND_INTERNAL_URL=http://backend:5050 python -m encproxy

Local mode (server + embedded client for testing):
    python -m encproxy --local
"""

import logging
import os
import time

from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_socketio import SocketIO
from prometheus_client import Counter, Gauge, Histogram, generate_latest

from encproxy.config import Config
from encproxy.relay import EncProxyRelay

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger("encproxy")

REQUEST_COUNT = Counter(
    "encproxy_http_requests_total",
    "Total HTTP requests",
    ["method", "endpoint", "status"],
)
REQUEST_LATENCY = Histogram(
    "encproxy_http_request_duration_seconds",
    "HTTP request latency",
    ["method", "endpoint"],
)
WEBSOCKET_CONNECTIONS = Gauge(
    "encproxy_websocket_connections",
    "Current WebSocket connections",
)
RELAYED_MESSAGES = Counter(
    "encproxy_relayed_messages_total",
    "Total relayed encrypted messages",
)


def _build_allowed_origins() -> list[str]:
    defaults = [
        "https://vondic.knopusmedia.ru",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5100",
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
    app = Flask("encproxy")
    app.config.from_object(Config)

    allowed_origins = _build_allowed_origins()
    async_mode = os.getenv("SOCKETIO_ASYNC_MODE", "eventlet")
    socketio = SocketIO(
        app,
        cors_allowed_origins=allowed_origins,
        async_mode=async_mode,
        logger=False,
        engineio_logger=False,
    )

    backend_url = os.environ.get("BACKEND_INTERNAL_URL", "http://127.0.0.1:5050")
    relay = EncProxyRelay(socketio, backend_url)
    relay.bind_events()

    @socketio.on("connect")
    def on_connect():
        WEBSOCKET_CONNECTIONS.inc()

    @socketio.on("disconnect")
    def on_disconnect():
        WEBSOCKET_CONNECTIONS.dec()

    @app.route("/")
    def index():
        return "EncProxy — Encryption relay server."

    @app.route("/health")
    def health():
        return jsonify({
            "status": "ok",
            "online_users": len(relay.get_online_user_ids()),
            "uptime": int(time.time()),
        })

    @app.route("/api/online-users")
    def online_users():
        return jsonify({
            "count": len(relay.get_online_user_ids()),
            "user_ids": relay.get_online_user_ids(),
        })

    @app.route("/metrics")
    def metrics():
        return generate_latest(), 200, {"Content-Type": "text/plain; charset=utf-8"}

    @app.before_request
    def before_request_metrics():
        endpoint = request.endpoint or "unknown"
        REQUEST_IN_PROGRESS.labels(
            method=request.method, endpoint=endpoint
        ).inc()
        request.start_time = time.time()

    @app.after_request
    def after_request_metrics(response):
        endpoint = request.endpoint or "unknown"
        status = response.status_code
        REQUEST_COUNT.labels(
            method=request.method, endpoint=endpoint, status=status
        ).inc()
        REQUEST_IN_PROGRESS.labels(
            method=request.method, endpoint=endpoint
        ).dec()
        if hasattr(request, "start_time") and request.start_time:
            latency = time.time() - request.start_time
            REQUEST_LATENCY.labels(
                method=request.method, endpoint=endpoint
            ).observe(latency)
        return response

    REQUEST_IN_PROGRESS = Gauge(
        "encproxy_http_requests_in_progress",
        "HTTP requests in progress",
        ["method", "endpoint"],
    )

    return app, socketio


if __name__ == "__main__":
    app, socketio = create_app()
    logger.info(f"EncProxy starting on {app.config['HOST']}:{app.config['PORT']}")
    socketio.run(
        app,
        host=app.config["HOST"],
        port=app.config["PORT"],
        debug=app.config["DEBUG"],
        allow_unsafe_werkzeug=True,
        use_reloader=False,
    )
