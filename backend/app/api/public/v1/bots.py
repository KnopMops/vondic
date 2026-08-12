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


def _extract_user_id(payload: dict) -> str:
    user_id = str(payload.get("user_id") or payload.get("from_user_id") or "")
    if user_id:
        return user_id
    token = payload.get("access_token")
    if token:
        try:
            from app.core.security import decode_access_token
            data = decode_access_token(token)
            if data and data.get("sub"):
                return str(data["sub"])
        except Exception:
            pass
    return "unknown"


@public_bots_router.post("/{bot_id}/callback")
@public_bots_router.post("/{bot_id}/callback_query")
@public_bots_router.post("/{bot_id}/callback-query")
async def handle_bot_callback(bot_id: str, payload: dict):
    user_id = _extract_user_id(payload)
    cb_data = payload.get("data") or payload.get("callback_data") or ""
    msg_id = str(payload.get("message_id") or "1")
    cb_id = f"cb_{int(time.time() * 1000)}"

    raw_update = {
        "update_id": int(time.time() * 1000),
        "callback_query": {
            "id": cb_id,
            "from": {
                "id": user_id,
                "username": "user",
                "first_name": "user",
            },
            "message": {
                "message_id": msg_id,
                "chat": {
                    "id": user_id,
                    "type": "private",
                },
            },
            "data": cb_data,
        },
    }
    UPDATE_QUEUES[bot_id].append(raw_update)

    outbox = []
    if user_id and user_id != "unknown":
        outbox_key = f"{bot_id}:{user_id}"
        while OUTBOX_QUEUES[outbox_key]:
            outbox.append(OUTBOX_QUEUES[outbox_key].popleft())

    return {"ok": True, "callback_id": cb_id, "outbox": outbox, "items": outbox}


@public_bots_router.post("/{bot_id}/answerCallbackQuery")
@public_bots_router.post("/{bot_id}/answer_callback_query")
@public_bots_router.post("/{bot_id}/answer-callback-query")
async def answer_bot_callback_query(bot_id: str, payload: dict):
    return {"ok": True, "result": True}


@public_bots_router.post("/{bot_id}/send")
@public_bots_router.post("/{bot_id}/sendMessage")
@public_bots_router.post("/{bot_id}/send_message")
@public_bots_router.post("/{bot_id}/send-message")
async def send_bot_message(
    bot_id: str,
    payload: dict,
):
    chat_id = str(payload.get("chat_id") or "")
    if not chat_id:
        raise HTTPException(status_code=400, detail="chat_id required")

    text = payload.get("text") or ""
    item = {
        "bot_id": bot_id,
        "chat_id": chat_id,
        "text": text,
        "reply_markup": payload.get("reply_markup"),
        "parse_mode": payload.get("parse_mode"),
        "game": payload.get("game"),
        "created_at": time.time(),
    }
    outbox_key = f"{bot_id}:{chat_id}"
    OUTBOX_QUEUES[outbox_key].append(item)

    try:
        from app.services.message_service import MessageService
        MessageService.create_message(
            {"content": text, "type": "text"},
            user_id=bot_id,
            target_id=chat_id,
        )
    except Exception as e:
        logger.warning("Error saving bot response to DB: %s", e)

    return {"ok": True, "result": item}


@public_bots_router.post("/{bot_id}/permissions/grant")
async def grant_bot_permissions(bot_id: str, payload: dict):
    return {"ok": True, "granted": True, "scopes": payload.get("scopes", "basic")}


@public_bots_router.post("/{bot_id}/token")
async def generate_bot_token_public(bot_id: str):
    return {"ok": True, "token": f"bot_token_{bot_id}"}


@public_bots_router.get("/{bot_id}/getUserProfilePhotos")
@public_bots_router.get("/{bot_id}/get_user_profile_photos")
async def get_user_profile_photos(bot_id: str, user_id: str = Query(...), offset: int = Query(0), limit: int = Query(1)):
    return {"ok": True, "total_count": 0, "photos": []}


@public_bots_router.get("/{bot_id}/getFile")
@public_bots_router.get("/{bot_id}/get_file")
async def get_file(bot_id: str, file_id: str = Query(...)):
    return {"ok": True, "file_id": file_id, "file_path": f"files/{file_id}"}


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
