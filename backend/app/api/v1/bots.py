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

