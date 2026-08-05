import logging
import os
import time
from typing import Any

import socketio
import uvicorn
from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from prometheus_client import Counter, Gauge, Histogram, generate_latest

from webrtc.config import Config
from webrtc.database import UserRepository
from webrtc.proxy import ConnectionBroker
from webrtc.signaling import SignalingService

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


def _build_allowed_origins() -> list[str]:
    defaults = [
        "https://vondic.ru",
        "https://webrtc.vondic.ru",
        "https://www.vondic.ru",
        "https://vondic.knopusmedia.ru",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5000",
        "http://localhost:1420",
        "http://127.0.0.1:1420",
        "http://192.168.140.10",
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
    allowed_origins = _build_allowed_origins()

    sio = socketio.AsyncServer(
        async_mode="asgi",
        cors_allowed_origins="*",
        logger=True,
        engineio_logger=True,
    )

    app = FastAPI(
        title="WebRTC Signaling Server API",
        description="API документация для асинхронного сервера сигнализации WebRTC",
        version="2.0.0",
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=allowed_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    user_repo = UserRepository()
    logger.info("WebRTC Server initialized (Async ASGI mode). Message encryption enabled.")
    broker = ConnectionBroker(user_repo)
    signaling = SignalingService(sio, broker, bind_disconnect=False)

    @app.on_event("startup")
    async def startup_event():
        await user_repo._ensure_schema()
        await signaling.load_existing_interactions()

    @sio.on("connect")
    async def on_connect(sid, environ, auth=None):
        WEBSOCKET_CONNECTIONS.inc()

    @sio.on("disconnect")
    async def on_disconnect(sid):
        WEBSOCKET_CONNECTIONS.dec()
        await signaling.on_disconnect(sid)

    @app.middleware("http")
    async def metrics_middleware(request: Request, call_next):
        endpoint = request.url.path
        method = request.method
        REQUEST_IN_PROGRESS.labels(method=method, endpoint=endpoint).inc()
        start_time = time.time()
        try:
            response = await call_next(request)
            status_code = response.status_code
        except Exception:
            status_code = 500
            raise
        finally:
            latency = time.time() - start_time
            REQUEST_COUNT.labels(method=method, endpoint=endpoint, status=status_code).inc()
            REQUEST_IN_PROGRESS.labels(method=method, endpoint=endpoint).dec()
            REQUEST_LATENCY.labels(method=method, endpoint=endpoint).observe(latency)
        return response

    @app.get("/")
    async def index():
        return "Сервер сигнализации WebRTC запущен (Async)."

    @app.get("/metrics")
    async def metrics():
        return Response(generate_latest(), media_type="text/plain; charset=utf-8")

    @app.get("/api/online-users")
    async def get_online_users():
        count = await user_repo.get_online_users_count()
        return {"count": count}

    @app.get("/get_socket_id/{user_id}")
    async def get_socket_id(user_id: str):
        socket_id = await broker.get_user_socket(user_id)
        if socket_id:
            return {"socket_id": socket_id}
        raise HTTPException(status_code=404, detail="Пользователь не найден или не в сети")

    @app.post("/set_socket_id")
    async def set_socket_id(data: dict[str, Any]):
        user_id = data.get("user_id")
        socket_id = data.get("socket_id")
        if not user_id or not socket_id:
            raise HTTPException(status_code=400, detail="Отсутствует user_id или socket_id")

        updated_user = await user_repo.update_socket_id_for_user(user_id, socket_id)
        if updated_user:
            return {"message": "Сокет пользователя успешно обновлён", "user": updated_user}
        raise HTTPException(status_code=404, detail="Пользователь не найден или ошибка базы данных")

    @app.post("/messages/history")
    async def get_messages_history(data: dict[str, Any]):
        token = data.get("token")
        target_id = data.get("target_id")
        limit = data.get("limit", 50)
        offset = data.get("offset", 0)

        if not token:
            raise HTTPException(status_code=401, detail="Требуется токен")

        user = await user_repo.fetch_user_by_token(token)
        if not user:
            raise HTTPException(status_code=401, detail="Неверный токен")

        messages = await user_repo.get_messages_history(user["id"], target_id, limit, offset)
        return messages

    @app.delete("/messages/history")
    async def delete_messages_history(data: dict[str, Any]):
        token = data.get("token")
        target_id = data.get("target_id")

        if not token:
            raise HTTPException(status_code=401, detail="Требуется токен")
        if not target_id:
            raise HTTPException(status_code=400, detail="Требуется target_id")

        user = await user_repo.fetch_user_by_token(token)
        if not user:
            raise HTTPException(status_code=401, detail="Неверный токен")

        scope = data.get("scope", "for_all")
        deleted = await user_repo.delete_messages_history(user["id"], target_id, scope=scope)
        return {"deleted": deleted}

    @app.post("/channels/history")
    async def get_channel_history(data: dict[str, Any]):
        token = data.get("token")
        channel_id = data.get("channel_id")
        limit = data.get("limit", 50)
        offset = data.get("offset", 0)

        if not token:
            raise HTTPException(status_code=401, detail="Требуется токен")
        if not channel_id:
            raise HTTPException(status_code=400, detail="Требуется channel_id")

        user = await user_repo.fetch_user_by_token(token)
        if not user:
            raise HTTPException(status_code=401, detail="Неверный токен")

        messages = await user_repo.get_channel_history(channel_id, limit, offset)
        return messages

    @app.delete("/channels/history")
    async def delete_channel_history(data: dict[str, Any]):
        token = data.get("token")
        channel_id = data.get("channel_id")

        if not token:
            raise HTTPException(status_code=401, detail="Требуется токен")
        if not channel_id:
            raise HTTPException(status_code=400, detail="Требуется channel_id")

        user = await user_repo.fetch_user_by_token(token)
        if not user:
            raise HTTPException(status_code=401, detail="Неверный токен")

        owner_id = await user_repo.get_channel_owner(channel_id)
        if owner_id and str(owner_id) != str(user["id"]):
            raise HTTPException(status_code=403, detail="Запрещено")

        participants = await user_repo.get_channel_participants(channel_id)
        if not participants or str(user["id"]) not in [str(p) for p in participants]:
            raise HTTPException(status_code=403, detail="Доступ запрещён")

        deleted = await user_repo.delete_channel_history(channel_id)
        return {"deleted": deleted}

    @app.delete("/groups/history")
    async def delete_group_history(data: dict[str, Any]):
        token = data.get("token")
        group_id = data.get("group_id")

        if not token:
            raise HTTPException(status_code=401, detail="Требуется токен")
        if not group_id:
            raise HTTPException(status_code=400, detail="Требуется group_id")

        user = await user_repo.fetch_user_by_token(token)
        if not user:
            raise HTTPException(status_code=401, detail="Неверный токен")

        participants = await user_repo.get_group_participants(group_id)
        if not participants or str(user["id"]) not in [str(p) for p in participants]:
            raise HTTPException(status_code=403, detail="Доступ запрещён")

        owner_id = await user_repo.get_group_owner(group_id)
        if owner_id and str(owner_id) != str(user["id"]):
            raise HTTPException(status_code=403, detail="Запрещено")

        deleted = await user_repo.delete_group_history(group_id)
        return {"deleted": deleted}

    @app.post("/chats/search")
    async def search_chats(data: dict[str, Any]):
        token = data.get("token")
        query = data.get("query")

        if not token:
            raise HTTPException(status_code=401, detail="Требуется токен")

        user = await user_repo.fetch_user_by_token(token)
        if not user:
            raise HTTPException(status_code=401, detail="Неверный токен")

        if not query:
            return []

        results = await user_repo.search_users(query)
        return results

    @app.post("/messages/search")
    async def search_messages(data: dict[str, Any]):
        token = data.get("token")
        target_id = data.get("target_id")
        query = data.get("query")

        if not token:
            raise HTTPException(status_code=401, detail="Требуется токен")

        user = await user_repo.fetch_user_by_token(token)
        if not user:
            raise HTTPException(status_code=401, detail="Неверный токен")

        if not target_id or not query:
            return []

        results = await user_repo.search_messages(user["id"], target_id, query)
        return results

    @app.post("/internal/broadcast_message")
    async def broadcast_message(data: dict[str, Any]):
        group_id = data.get("group_id")
        channel_id = data.get("channel_id")
        target_id = data.get("target_id")
        payload = data.get("payload")

        if not payload:
            raise HTTPException(status_code=400, detail="Отсутствует payload")

        if group_id:
            participants = await user_repo.get_group_participants(group_id)
            for pid in participants:
                pid_socket = await broker.get_user_socket(pid)
                if pid_socket:
                    await sio.emit("receive_message", payload, room=pid_socket)
        elif channel_id:
            participants = await user_repo.get_channel_participants(channel_id)
            if not participants:
                owner_id = await user_repo.get_channel_owner(channel_id)
                if owner_id:
                    participants = [owner_id]
            for pid in participants:
                pid_socket = await broker.get_user_socket(pid)
                if pid_socket:
                    await sio.emit("receive_message", payload, room=pid_socket)
        elif target_id:
            target_socket = await broker.get_user_socket(target_id)
            if target_socket:
                await sio.emit("receive_message", payload, room=target_socket)
        else:
            raise HTTPException(status_code=400, detail="Отсутствует group_id, channel_id или target_id")

        return {"status": "success"}

    combined_app = socketio.ASGIApp(sio, app)
    return combined_app


asgi_app = create_app()

if __name__ == "__main__":
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", 5000))
    logger.info(f"Запуск асинхронного WebRTC сервера на {host}:{port}")
    uvicorn.run("webrtc.main:asgi_app", host=host, port=port, reload=False)
