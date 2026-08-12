import logging
import time
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_async_session
from app.core.deps import get_current_user
from app.models.bot import Bot
from app.models.user import User

logger = logging.getLogger(__name__)

bots_router = APIRouter(prefix="/api/v1/bots", tags=["Bots"])


@bots_router.get("")
@bots_router.get("/")
async def get_bots(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session),
):
    stmt = select(Bot).where(Bot.is_active == 1)
    res = await db.execute(stmt)
    bots = res.scalars().all()
    return [{"id": b.id, "name": b.name, "description": b.description, "avatar_url": b.avatar_url, "is_verified": bool(b.is_verified)} for b in bots]


@bots_router.post("/search")
async def search_bots(
    payload: Dict[str, Any],
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session),
):
    query = payload.get("query", "").strip()
    if not query:
        raise HTTPException(status_code=400, detail="query is required")

    stmt = select(Bot).where(Bot.name.ilike(f"%{query}%"), Bot.is_active == 1)
    res = await db.execute(stmt)
    bots = res.scalars().all()
    return [{"id": b.id, "name": b.name, "description": b.description, "avatar_url": b.avatar_url, "is_verified": bool(b.is_verified)} for b in bots]


@bots_router.post("", status_code=status.HTTP_201_CREATED)
@bots_router.post("/", status_code=status.HTTP_201_CREATED)
async def create_bot(
    payload: Dict[str, Any],
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session),
):
    name = payload.get("name")
    if not name:
        raise HTTPException(status_code=400, detail="Bot name is required")

    bot = Bot(
        name=name,
        description=payload.get("description"),
        avatar_url=payload.get("avatar_url"),
        owner_id=current_user.id,
    )
    db.add(bot)
    await db.commit()
    await db.refresh(bot)

    chat_url = f"/feed/messages?bot_id={bot.id}"
    return {
        "id": bot.id,
        "name": bot.name,
        "description": bot.description,
        "avatar_url": bot.avatar_url,
        "owner_id": bot.owner_id,
        "chat_url": chat_url,
    }


@bots_router.post("/{bot_id}/verify")
async def verify_bot(
    bot_id: str,
    payload: Dict[str, Any],
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session),
):
    if (current_user.role or "").lower() not in ["admin"]:
        raise HTTPException(status_code=403, detail="Admin access required")

    stmt = select(Bot).where(Bot.id == bot_id)
    res = await db.execute(stmt)
    bot = res.scalars().first()

    if not bot:
        raise HTTPException(status_code=404, detail="Bot not found")

    is_verified = bool(payload.get("is_verified", True))
    bot.is_verified = 1 if is_verified else 0
    await db.commit()
    return {"ok": True, "is_verified": bot.is_verified}


from app.api.public.v1.bots import (
    push_bot_update,
    get_bot_updates,
    send_bot_message,
    get_bot_outbox,
    handle_bot_callback,
    answer_bot_callback_query,
)

@bots_router.post("/{bot_id}/updates/push")
async def push_update_alias(bot_id: str, payload: dict):
    return await push_bot_update(bot_id, payload)

@bots_router.get("/{bot_id}/updates")
async def get_updates_alias(bot_id: str, offset: int = Query(0), limit: int = Query(100), timeout: int = Query(2)):
    return await get_bot_updates(bot_id, offset, limit, timeout)

@bots_router.post("/{bot_id}/send")
@bots_router.post("/{bot_id}/sendMessage")
@bots_router.post("/{bot_id}/send_message")
@bots_router.post("/{bot_id}/send-message")
async def send_message_alias(bot_id: str, payload: dict):
    return await send_bot_message(bot_id, payload)

@bots_router.post("/{bot_id}/callback")
@bots_router.post("/{bot_id}/callback_query")
@bots_router.post("/{bot_id}/callback-query")
async def callback_alias(bot_id: str, payload: dict):
    return await handle_bot_callback(bot_id, payload)

@bots_router.post("/{bot_id}/answerCallbackQuery")
@bots_router.post("/{bot_id}/answer_callback_query")
@bots_router.post("/{bot_id}/answer-callback-query")
async def answer_callback_alias(bot_id: str, payload: dict):
    return await answer_bot_callback_query(bot_id, payload)

@bots_router.get("/{bot_id}/permissions")
@bots_router.get("/{bot_id}/permissions/{user_id}")
async def get_permissions_alias(bot_id: str, user_id: Optional[str] = None):
    return {"granted": True, "scopes": ["basic", "user_info", "send_messages"]}

@bots_router.get("/{bot_id}/outbox")
async def get_outbox_alias(bot_id: str, chat_id: str = Query(...)):
    return await get_bot_outbox(bot_id, chat_id)

