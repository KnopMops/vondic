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
