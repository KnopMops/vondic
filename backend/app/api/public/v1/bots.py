import logging
import time
from collections import defaultdict, deque
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Query, status
from pydantic import BaseModel

from app.services.bot_service import BotService

public_bots_router = APIRouter(prefix="/api/public/v1/bots", tags=["Public Bots v1"])
logger = logging.getLogger(__name__)

UPDATE_QUEUES = defaultdict(deque)
UPDATE_COUNTERS = defaultdict(int)
OUTBOX_QUEUES = defaultdict(deque)
OUTBOX_COUNTERS = defaultdict(int)


def _get_bot_token(authorization: Optional[str] = Header(None), x_bot_token: Optional[str] = Header(None)) -> Optional[str]:
    if authorization and authorization.startswith("Bot "):
        return authorization.replace("Bot ", "", 1).strip()
    if x_bot_token:
        return x_bot_token.strip()
    return None


@public_bots_router.get("")
@public_bots_router.get("/")
async def list_public_bots():
    bots = BotService.get_active_bots()
    return {"bots": [b.to_dict() if hasattr(b, "to_dict") else b for b in bots]}


@public_bots_router.get("/{bot_id}")
async def get_public_bot(bot_id: str):
    bot = BotService.get_active_bot_by_id(bot_id)
    if not bot:
        raise HTTPException(status_code=404, detail="Bot not found")
    return {"bot": bot.to_dict() if hasattr(bot, "to_dict") else bot}


@public_bots_router.get("/by-name/{name}")
async def get_public_bot_by_name(name: str):
    bot = BotService.get_active_bot_by_name(name)
    if not bot:
        raise HTTPException(status_code=404, detail="Bot not found")
    return {"bot": bot.to_dict() if hasattr(bot, "to_dict") else bot}


@public_bots_router.post("/{bot_id}/updates/push")
async def push_bot_update(bot_id: str, payload: dict):
    raw_update = payload.get("update") or payload.get("message") or payload
    if isinstance(raw_update, dict) and "update_id" not in raw_update:
        raw_update["update_id"] = int(time.time() * 1000)
    UPDATE_QUEUES[bot_id].append(raw_update)

    chat_id = None
    if isinstance(raw_update, dict):
        msg = raw_update.get("message") or raw_update
        if isinstance(msg, dict):
            chat = msg.get("chat") or {}
            chat_id = str(chat.get("id") or "")

    outbox = []
    if chat_id:
        outbox_key = f"{bot_id}:{chat_id}"
        while OUTBOX_QUEUES[outbox_key]:
            outbox.append(OUTBOX_QUEUES[outbox_key].popleft())

    return {"ok": True, "outbox": outbox, "items": outbox}


@public_bots_router.get("/{bot_id}/updates")
async def get_bot_updates(
    bot_id: str,
    offset: int = Query(0),
    limit: int = Query(100),
    timeout: int = Query(2),
    bot_token: Optional[str] = Depends(_get_bot_token),
):
    import asyncio
    items = []
    start_time = time.time()
    while time.time() - start_time < min(timeout, 3):
        q = UPDATE_QUEUES[bot_id]
        while q:
            upd = q.popleft()
            upd_id = upd.get("update_id", 0) if isinstance(upd, dict) else 0
            if upd_id >= offset:
                items.append(upd)
                if len(items) >= limit:
                    break
        if items:
            break
        await asyncio.sleep(0.1)
    return {"items": items}


@public_bots_router.post("/{bot_id}/send_message")
@public_bots_router.post("/{bot_id}/send-message")
async def send_bot_message(
    bot_id: str,
    payload: dict,
):
    chat_id = str(payload.get("chat_id") or "")
    if not chat_id:
        raise HTTPException(status_code=400, detail="chat_id required")

    item = {
        "bot_id": bot_id,
        "chat_id": chat_id,
        "text": payload.get("text") or "",
        "reply_markup": payload.get("reply_markup"),
        "parse_mode": payload.get("parse_mode"),
        "game": payload.get("game"),
        "created_at": time.time(),
    }
    outbox_key = f"{bot_id}:{chat_id}"
    OUTBOX_QUEUES[outbox_key].append(item)
    return {"ok": True, "result": item}


@public_bots_router.get("/{bot_id}/permissions/{user_id}")
async def get_bot_user_permissions(bot_id: str, user_id: str):
    return {"granted": True, "scopes": ["basic", "user_info"]}


@public_bots_router.get("/{bot_id}/outbox")
async def get_bot_outbox(
    bot_id: str,
    chat_id: str = Query(...),
):
    outbox_key = f"{bot_id}:{chat_id}"
    items = []
    q = OUTBOX_QUEUES[outbox_key]
    while q:
        items.append(q.popleft())
    return {"items": items, "outbox": items}
