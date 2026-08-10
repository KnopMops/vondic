import logging
from typing import Any, Dict, Optional
from fastapi import FastAPI, HTTPException, Request, status, Depends
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_async_db
from app.models.user import User

# Import API Routers
from app.api.v1.auth import auth_router
from app.api.v1.upload import upload_router
from app.api.v1.stickers import stickers_router
from app.api.v1.users import users_router
from app.api.v1.bots import bots_router
from app.api.v1.posts import posts_router
from app.api.v1.messages import messages_router
from app.api.v1.comments import comments_router
from app.api.v1.channels import channels_router
from app.api.v1.groups import groups_router
from app.api.v1.group_roles import group_roles_router
from app.api.v1.communities import communities_router
from app.api.v1.social_communities import social_communities_router
from app.api.v1.playlists import playlists_router
from app.api.v1.gifts import gifts_router
from app.api.v1.storis import storis_router
from app.api.v1.videos import videos_router
from app.api.v1.payments import payments_router
from app.api.v1.direct_messages import dm_router
from app.api.v1.friends import friends_router
from app.api.v1.files import files_router
from app.api.v1.mail import mail_router
from app.api.v1.subscriptions import subscriptions_router
from app.api.v1.support import support_router
from app.api.v1.search import search_router
from app.api.v1.scheduled_messages import scheduled_router
from app.api.v1.polls import polls_router
from app.api.v1.devices import devices_router
from app.api.v1.chat_folders import chat_folders_router
from app.api.v1.audit_log import audit_log_router
from app.api.v1.app_downloads import app_downloads_router
from app.api.v1.bot_games import bot_games_router
from app.api.oauth import oauth_router
from app.api.v2.marketplace import v2_marketplace_router
from app.api.v2.webhooks import v2_webhooks_router
from app.api.public.v1.bots import public_bots_router

# Load extension routes
import app.api.v1.users_extension  # noqa: F401

logger = logging.getLogger(__name__)

app = FastAPI(
    title="Vondic API",
    description="High-performance async API backend for Vondic platform",
    version="2.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
)

# Configure CORS
allowed_origins = [
    "https://vondic.ru",
    "https://vondic.knopusmedia.ru",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:5000",
    "http://localhost:1420",
    "http://127.0.0.1:1420",
    "tauri://localhost",
]
if settings.FRONTEND_URL and settings.FRONTEND_URL not in allowed_origins:
    allowed_origins.append(settings.FRONTEND_URL)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Total-Count"],
)


@app.middleware("http")
async def alias_path_middleware(request: Request, call_next):
    """
    Middleware to route legacy `/api/...` paths to `/api/v1/...`.
    E.g. `/api/auth/me` -> `/api/v1/auth/me`.
    """
    path = request.url.path
    if (
        path.startswith("/api/")
        and not path.startswith("/api/v1/")
        and not path.startswith("/api/v2/")
        and not path.startswith("/api/public/")
    ):
        new_path = "/api/v1/" + path[5:]
        request.scope["path"] = new_path
    return await call_next(request)


@app.exception_handler(HTTPException)
async def custom_http_exception_handler(request: Request, exc: HTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": exc.detail},
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    errors = exc.errors()
    first_error = errors[0]["msg"] if errors else "Invalid request data"
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"error": first_error, "details": errors},
    )


# Health check endpoint
@app.get("/healthz", tags=["Health"])
@app.get("/api/v1/healthz", tags=["Health"])
async def healthz():
    return {"status": "ok", "service": "vondic-backend"}


@app.get("/api/v1/online-users", tags=["Users"])
@app.get("/api/online-users", tags=["Users"])
async def get_online_users(db: AsyncSession = Depends(get_async_db)):
    res = await db.execute(select(User).where(User.status == "online"))
    users = res.scalars().all()
    return {"count": len(users), "users": [u.to_dict() for u in users]}


@app.post("/api/v1/push/subscribe", tags=["Users"])
@app.post("/api/push/subscribe", tags=["Users"])
async def push_subscribe_global(
    payload: Dict[str, Any],
    db: AsyncSession = Depends(get_async_db),
):
    user_id = payload.get("user_id")
    endpoint = payload.get("endpoint")
    p256dh = payload.get("p256dh") or payload.get("keys", {}).get("p256dh")
    auth = payload.get("auth") or payload.get("keys", {}).get("auth")
    platform = payload.get("platform", "web")

    if not user_id or not endpoint:
        return {"ok": True, "message": "Ignored missing user_id or endpoint"}

    try:
        await db.execute(text(
            "CREATE TABLE IF NOT EXISTS push_subscriptions ("
            "id SERIAL PRIMARY KEY, user_id TEXT NOT NULL, endpoint TEXT NOT NULL, "
            "p256dh TEXT NOT NULL, auth TEXT NOT NULL, platform TEXT DEFAULT 'web', "
            "created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, "
            "CONSTRAINT uq_push_sub_user_ep UNIQUE (user_id, endpoint))"
        ))
        await db.execute(text(
            "INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, platform) "
            "VALUES (:uid, :ep, :p256, :auth, :plat) "
            "ON CONFLICT (user_id, endpoint) DO UPDATE SET p256dh = :p256, auth = :auth, platform = :plat"
        ), {"uid": user_id, "ep": endpoint, "p256": p256dh or "", "auth": auth or "", "plat": platform})
        await db.commit()
        return {"ok": True}
    except Exception as e:
        return {"ok": False, "error": str(e)}


# Mount all FastAPI APIRouters
app.include_router(auth_router)
app.include_router(upload_router)
app.include_router(stickers_router)
app.include_router(users_router)
app.include_router(bots_router)
app.include_router(posts_router)
app.include_router(messages_router)
app.include_router(comments_router)
app.include_router(channels_router)
app.include_router(groups_router)
app.include_router(group_roles_router)
app.include_router(communities_router)
app.include_router(social_communities_router)
app.include_router(playlists_router)
app.include_router(gifts_router)
app.include_router(storis_router)
app.include_router(videos_router)
app.include_router(payments_router)
app.include_router(dm_router)
app.include_router(friends_router)
app.include_router(files_router)
app.include_router(mail_router)
app.include_router(subscriptions_router)
app.include_router(support_router)
app.include_router(search_router)
app.include_router(scheduled_router)
app.include_router(polls_router)
app.include_router(devices_router)
app.include_router(chat_folders_router)
app.include_router(audit_log_router)
app.include_router(app_downloads_router)
app.include_router(bot_games_router)
app.include_router(oauth_router)
app.include_router(v2_marketplace_router)
app.include_router(v2_webhooks_router)
app.include_router(public_bots_router)
