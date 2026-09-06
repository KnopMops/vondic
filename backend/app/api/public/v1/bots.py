import asyncio
import json as _json
import logging
import os
import time
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Query, status
from pydantic import BaseModel

from app.services.bot_service import BotService

public_bots_router = APIRouter(prefix="/api/public/v1/bots", tags=["Public Bots v1"])
logger = logging.getLogger(__name__)

# ── Redis-backed queues (shared across gunicorn workers) ──────────
_REDIS = None


def _get_redis():
    global _REDIS
    if _REDIS is None:
        import redis as redis_mod
        _REDIS = redis_mod.Redis(
            host=os.environ.get("REDIS_HOST", "redis"),
            port=int(os.environ.get("REDIS_PORT", 6379)),
            db=0, decode_responses=True,
        )
    return _REDIS


def _q_push(key: str, item: dict):
    """Push item onto a Redis list (RPUSH = FIFO with LPOP)."""
    _get_redis().rpush(key, _json.dumps(item))


def _q_pop(key: str):
    """Pop one item from the left of a Redis list."""
    raw = _get_redis().lpop(key)
    return _json.loads(raw) if raw else None


def _q_len(key: str) -> int:
    return _get_redis().llen(key)


def _q_drain(key: str, limit: int = 100):
    """Pop up to *limit* items from the queue."""
    items = []
    pipe = _get_redis().pipeline()
    for _ in range(limit):
        pipe.lpop(key)
    results = pipe.execute()
    for raw in results:
        if raw is None:
            break
        items.append(_json.loads(raw))
    return items


def _pub_notify(channel: str):
    """Publish a wakeup notification on a Redis pub/sub channel."""
    try:
        _get_redis().publish(channel, "1")
    except Exception:
        logger.debug("Redis publish failed for %s", channel)


# Kept for backward compatibility (v1/bots.py imports these symbol names)
UPDATE_QUEUES = None
OUTBOX_QUEUES = None
UPDATE_EVENTS = None


def _get_bot_token(authorization: Optional[str] = Header(None), x_bot_token: Optional[str] = Header(None)) -> Optional[str]:
    if authorization and authorization.startswith("Bot "):
        return authorization.replace("Bot ", "", 1).strip()
    if x_bot_token:
        return x_bot_token.strip()
    return None


def _resolve_bot_id(bot_id: str) -> str:
    if not bot_id or bot_id in ("botik", "default", "vondic_bot"):
        bots = BotService.get_active_bots()
        if bots:
            return str(bots[0].id)
        return "7e140ffc-5549-418a-8bad-525c02193812"
    return bot_id


@public_bots_router.get("")
@public_bots_router.get("/")
async def list_public_bots():
    bots = BotService.get_active_bots()
    return {"bots": [b.to_dict() if hasattr(b, "to_dict") else b for b in bots]}


@public_bots_router.get("/search")
@public_bots_router.post("/search")
async def search_public_bots(payload: Optional[dict] = None, q: Optional[str] = Query(None)):
    query_str = q or (payload.get("query") if payload else "") or (payload.get("q") if payload else "") or ""
    bots = BotService.search_active_bots(query_str) if query_str else BotService.get_active_bots()
    items = [b.to_dict() if hasattr(b, "to_dict") else b for b in bots]
    return {"bots": items, "items": items}


@public_bots_router.get("/{bot_id}")
async def get_public_bot(bot_id: str):
    bot_id = _resolve_bot_id(bot_id)
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
    bot_id = _resolve_bot_id(bot_id)
    if "message" in payload and "update_id" in payload:
        raw_update = payload
    elif "update" in payload:
        raw_update = payload["update"]
    elif "message" in payload:
        raw_update = {"update_id": int(time.time() * 1000), "message": payload["message"]}
    elif "text" in payload or "message_id" in payload:
        raw_update = {"update_id": int(time.time() * 1000), "message": payload}
    else:
        raw_update = payload

    if isinstance(raw_update, dict) and "update_id" not in raw_update:
        raw_update["update_id"] = int(time.time() * 1000)

    _q_push(f"bot:updates:{bot_id}", raw_update)
    _pub_notify(f"bot:updates:{bot_id}")

    chat_id = None
    if isinstance(raw_update, dict):
        msg = raw_update.get("message") or raw_update
        if isinstance(msg, dict):
            chat = msg.get("chat") or {}
            chat_id = str(chat.get("id") or "")

    outbox = []
    if chat_id:
        outbox = _q_drain(f"bot:outbox:{bot_id}:{chat_id}")

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
    bot_id = _resolve_bot_id(bot_id)
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
    _q_push(f"bot:updates:{bot_id}", raw_update)
    _pub_notify(f"bot:updates:{bot_id}")

    outbox = []
    if user_id and user_id != "unknown":
        outbox = _q_drain(f"bot:outbox:{bot_id}:{user_id}")

    return {"ok": True, "callback_id": cb_id, "outbox": outbox, "items": outbox}


@public_bots_router.post("/{bot_id}/answerCallbackQuery")
@public_bots_router.post("/{bot_id}/answer_callback_query")
@public_bots_router.post("/{bot_id}/answer-callback-query")
async def answer_bot_callback_query(bot_id: str, payload: dict):
    return {"ok": True, "result": True}


@public_bots_router.get("/{bot_id}/updates")
async def get_bot_updates(
    bot_id: str,
    offset: int = Query(0),
    limit: int = Query(100),
    timeout: int = Query(2),
    bot_token: Optional[str] = Depends(_get_bot_token),
):
    bot_id = _resolve_bot_id(bot_id)
    queue_key = f"bot:updates:{bot_id}"

    items = _q_drain(queue_key, limit)
    if items or timeout <= 0:
        return {"items": items}

    # Long-poll: wait for a Redis pub/sub notification or timeout
    max_wait = min(max(timeout, 0), 5)
    deadline = time.time() + max_wait
    r = _get_redis()
    pubsub = r.pubsub()
    try:
        pubsub.subscribe(queue_key)
        while time.time() < deadline:
            remaining = deadline - time.time()
            msg = pubsub.get_message(timeout=min(remaining, 0.5))
            if msg and msg.get("type") == "message":
                break
            await asyncio.sleep(0)
            items = _q_drain(queue_key, limit)
            if items:
                break
    finally:
        try:
            pubsub.unsubscribe()
            pubsub.close()
        except Exception:
            pass

    if not items:
        items = _q_drain(queue_key, limit)
    return {"items": items}


@public_bots_router.get("/{bot_id}/games")
async def get_public_bot_games(
    bot_id: str,
    q: Optional[str] = Query(None),
    bot_token: Optional[str] = Depends(_get_bot_token),
):
    bot_id = _resolve_bot_id(bot_id)
    from app.services.bot_game_service import BotGameService
    bot = BotGameService.get_bot(bot_id)
    if not bot:
        return {"games": [], "bot_id": bot_id}
    games = BotGameService.list_games(bot_id, query=q, published_only=True)
    return {"games": [BotGameService.serialize(g) for g in games], "bot_id": bot_id}


def _send_webrtc_broadcast_sync(webrtc_url: str, broadcast_payload: dict):
    import json
    import urllib.request
    try:
        data = json.dumps(broadcast_payload).encode("utf-8")
        req = urllib.request.Request(
            f"{webrtc_url}/internal/broadcast_message",
            data=data,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=2) as resp:
            resp.read()
    except Exception as e:
        logger.warning("Error broadcasting bot message to WebRTC: %s", e)


@public_bots_router.post("/{bot_id}/send")
@public_bots_router.post("/{bot_id}/sendMessage")
@public_bots_router.post("/{bot_id}/send_message")
@public_bots_router.post("/{bot_id}/send-message")
async def send_bot_message(
    bot_id: str,
    payload: dict,
):
    bot_id = _resolve_bot_id(bot_id)
    chat_id = str(payload.get("chat_id") or "")
    if not chat_id:
        raise HTTPException(status_code=400, detail="chat_id required")

    text = payload.get("text") or ""
    game_raw = payload.get("game")

    # Resolve game metadata if a game ID was provided
    game_meta = None
    if isinstance(game_raw, dict) and game_raw.get("id"):
        try:
            from app.services.bot_game_service import BotGameService
            game_obj = BotGameService.get_game(bot_id, str(game_raw["id"]))
            if game_obj:
                game_meta = {
                    "id": game_obj.id,
                    "title": game_obj.title,
                    "embed_url": f"/api/v1/bots/{bot_id}/games/{game_obj.id}/embed",
                    "download_url": f"/api/v1/bots/{bot_id}/games/{game_obj.id}/download",
                    "play_url": f"/feed/bot-game/{bot_id}/{game_obj.id}",
                }
        except Exception as e:
            logger.warning("Error resolving game %s: %s", game_raw.get("id"), e)

    item = {
        "bot_id": bot_id,
        "chat_id": chat_id,
        "text": text,
        "reply_markup": payload.get("reply_markup"),
        "parse_mode": payload.get("parse_mode"),
        "game": game_meta or game_raw,
        "created_at": time.time(),
    }
    _q_push(f"bot:outbox:{bot_id}:{chat_id}", item)

    msg_id = None
    iso_time = datetime.utcnow().isoformat() + "Z"
    msg_type = "game" if game_meta else "text"
    try:
        from app.services.message_service import MessageService
        msg_obj, _ = MessageService.create_message(
            {"content": text or (game_meta.get("title") if game_meta else ""), "type": msg_type},
            user_id=bot_id,
            target_id=chat_id,
        )
        if msg_obj:
            msg_id = getattr(msg_obj, "id", None)
            ts = getattr(msg_obj, "timestamp", None) or getattr(msg_obj, "created_at", None)
            if ts and hasattr(ts, "isoformat"):
                iso_time = ts.isoformat() + "Z"
    except Exception as e:
        logger.warning("Error saving bot response to DB: %s", e)

    try:
        import os
        import asyncio
        webrtc_url = os.getenv("WEBRTC_INTERNAL_URL", "http://webrtc:5000")
        broadcast_payload = {
            "target_id": chat_id,
            "payload": {
                "id": msg_id or f"bot_msg_{int(time.time()*1000)}",
                "sender_id": bot_id,
                "target_id": chat_id,
                "content": text,
                "reply_markup": payload.get("reply_markup"),
                "type": msg_type,
                "game": game_meta,
                "timestamp": iso_time,
                "is_read": 0,
            }
        }
        await asyncio.to_thread(_send_webrtc_broadcast_sync, webrtc_url, broadcast_payload)
    except Exception as e:
        logger.warning("Error scheduling bot message broadcast: %s", e)

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
    """Check if user has granted permissions to this bot. Returns bot's required scopes + granted scopes."""
    bot_id = _resolve_bot_id(bot_id)
    from app.models.bot import Bot, BOT_SCOPES

    bot = Bot.query.get(bot_id)
    required = bot.get_scopes() if bot else ["username", "send_messages"]

    # Check Redis for granted consent
    consent_key = f"bot:consent:{bot_id}:{user_id}"
    r = _get_redis()
    granted_raw = r.get(consent_key)
    if granted_raw:
        granted_scopes = _json.loads(granted_raw)
        return {
            "granted": True,
            "required_scopes": required,
            "granted_scopes": granted_scopes,
            "scope_descriptions": {s: BOT_SCOPES.get(s, s) for s in required},
        }

    return {
        "granted": False,
        "required_scopes": required,
        "granted_scopes": [],
        "scope_descriptions": {s: BOT_SCOPES.get(s, s) for s in required},
    }


@public_bots_router.post("/{bot_id}/permissions/grant")
async def grant_bot_permissions(bot_id: str, payload: dict):
    """User grants consent to a bot. Stores in Redis."""
    bot_id = _resolve_bot_id(bot_id)
    user_id = str(payload.get("user_id") or "")
    scopes = payload.get("scopes") or []

    if not user_id:
        raise HTTPException(status_code=400, detail="user_id required")

    consent_key = f"bot:consent:{bot_id}:{user_id}"
    r = _get_redis()
    r.set(consent_key, _json.dumps(scopes), ex=86400 * 365)  # 1 year

    return {"ok": True, "granted": True, "scopes": scopes}


@public_bots_router.post("/{bot_id}/permissions/revoke")
async def revoke_bot_permissions(bot_id: str, payload: dict):
    """User revokes consent from a bot."""
    bot_id = _resolve_bot_id(bot_id)
    user_id = str(payload.get("user_id") or "")
    if not user_id:
        raise HTTPException(status_code=400, detail="user_id required")

    consent_key = f"bot:consent:{bot_id}:{user_id}"
    r = _get_redis()
    r.delete(consent_key)

    return {"ok": True, "revoked": True}


@public_bots_router.get("/{bot_id}/outbox")
async def get_bot_outbox(
    bot_id: str,
    chat_id: str = Query(...),
):
    bot_id = _resolve_bot_id(bot_id)
    items = _q_drain(f"bot:outbox:{bot_id}:{chat_id}")
    return {"items": items, "outbox": items}


@public_bots_router.post("/{bot_id}/update")
async def bot_self_update(
    bot_id: str,
    payload: dict,
    bot_token: Optional[str] = Depends(_get_bot_token),
):
    """Bot can update its own name, description, avatar_url via Bot token."""
    bot_id = _resolve_bot_id(bot_id)
    from app.core.extensions import db
    from app.models.bot import Bot

    bot = Bot.query.get(bot_id)
    if not bot:
        raise HTTPException(status_code=404, detail="Bot not found")

    if "name" in payload:
        bot.name = payload["name"]
    if "description" in payload:
        bot.description = payload["description"]
    if "avatar_url" in payload:
        bot.avatar_url = payload["avatar_url"]
    if "required_scopes" in payload:
        scopes = payload["required_scopes"]
        if isinstance(scopes, list):
            bot.set_scopes(scopes)

    db.session.commit()
    return {"ok": True, "bot_id": bot_id}
