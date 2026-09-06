"""Public API v2 — Chat & Messages endpoints (API-key authenticated).

Full access to messaging: send, edit, delete, history, reactions.
Available to bots and integrations via API key or bot token.
"""
import json
import logging
import os
import time
import uuid
import asyncio
from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel

from app.api.public.v2.auth import get_bot_or_api_key_user

logger = logging.getLogger(__name__)

v2_chat_router = APIRouter(prefix="/api/public/v2/chat", tags=["Public API v2 — Chat"])


# ── Schemas ──────────────────────────────────────────────────────────

class SendMessageSchema(BaseModel):
    target_user_id: Optional[str] = None
    channel_id: Optional[str] = None
    group_id: Optional[str] = None
    content: str
    type: Optional[str] = "text"
    attachments: Optional[List[Dict[str, Any]]] = None
    reply_to: Optional[str] = None
    thread_id: Optional[str] = None


class EditMessageSchema(BaseModel):
    content: str


class ReactionSchema(BaseModel):
    emoji: str


class ForwardMessageSchema(BaseModel):
    to_chat_id: str
    message_ids: List[str]


# ── Helpers ──────────────────────────────────────────────────────────

def _send_webrtc_broadcast_sync(webrtc_url: str, broadcast_payload: dict):
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
        logger.warning("Error broadcasting to WebRTC: %s", e)


async def _broadcast_message(target_id: str, payload: dict):
    """Broadcast a message to WebRTC for real-time delivery."""
    try:
        webrtc_url = os.getenv("WEBRTC_INTERNAL_URL", "http://webrtc:5000")
        broadcast_payload = {
            "target_id": target_id,
            "payload": payload,
        }
        await asyncio.to_thread(_send_webrtc_broadcast_sync, webrtc_url, broadcast_payload)
    except Exception as e:
        logger.warning("WebRTC broadcast error: %s", e)


# ── Endpoints ────────────────────────────────────────────────────────

@v2_chat_router.post("/messages")
async def send_message(
    payload: SendMessageSchema,
    auth: dict = Depends(get_bot_or_api_key_user),
):
    """Send a message to a user, group, or channel."""
    sender_id = auth["user_id"]

    if not payload.target_user_id and not payload.channel_id and not payload.group_id:
        raise HTTPException(status_code=400, detail="target_user_id, channel_id, or group_id required")

    if not payload.content and not payload.attachments:
        raise HTTPException(status_code=400, detail="content or attachments required")

    message_id = str(uuid.uuid4())
    timestamp = datetime.utcnow().isoformat() + "Z"

    # Save to DB via MessageService
    msg_obj = None
    try:
        from app.services.message_service import MessageService
        msg_obj, err = MessageService.create_message(
            {
                "content": payload.content,
                "type": payload.type or "text",
                "attachments": payload.attachments,
            },
            user_id=sender_id,
            target_id=payload.target_user_id,
            group_id=payload.group_id,
        )
        if msg_obj:
            message_id = getattr(msg_obj, "id", message_id)
            ts = getattr(msg_obj, "timestamp", None) or getattr(msg_obj, "created_at", None)
            if ts and hasattr(ts, "isoformat"):
                timestamp = ts.isoformat() + "Z"
    except Exception as e:
        logger.warning("MessageService.create_message error: %s", e)

    # Build message payload for real-time delivery
    msg_payload = {
        "id": message_id,
        "sender_id": sender_id,
        "content": payload.content,
        "type": payload.type or "text",
        "attachments": payload.attachments,
        "timestamp": timestamp,
        "is_read": 0,
    }
    if payload.target_user_id:
        msg_payload["target_id"] = payload.target_user_id
    if payload.channel_id:
        msg_payload["channel_id"] = payload.channel_id
    if payload.group_id:
        msg_payload["group_id"] = payload.group_id
    if payload.reply_to:
        msg_payload["reply_to"] = payload.reply_to

    # Broadcast via WebRTC
    target_for_broadcast = payload.target_user_id or payload.channel_id or payload.group_id
    if target_for_broadcast:
        await _broadcast_message(target_for_broadcast, msg_payload)

    return {
        "ok": True,
        "message": msg_payload,
    }


@v2_chat_router.get("/messages/{target_id}")
async def get_messages(
    target_id: str,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    auth: dict = Depends(get_bot_or_api_key_user),
):
    """Get message history with a user, group, or channel."""
    user_id = auth["user_id"]

    try:
        from app.services.message_service import MessageService
        messages = MessageService.get_direct_messages(user_id, target_id, limit=limit)
        return {
            "ok": True,
            "messages": [m.to_dict() if hasattr(m, "to_dict") else m for m in messages],
            "limit": limit,
            "offset": offset,
        }
    except Exception as e:
        logger.warning("get_messages error: %s", e)
        return {"ok": True, "messages": [], "limit": limit, "offset": offset}


@v2_chat_router.put("/messages/{message_id}")
async def edit_message(
    message_id: str,
    payload: EditMessageSchema,
    auth: dict = Depends(get_bot_or_api_key_user),
):
    """Edit a message."""
    if not payload.content:
        raise HTTPException(status_code=400, detail="content required")

    try:
        from app.core.database import get_async_session
        from app.models.message import Message as MessageModel
        from sqlalchemy import select

        async for db in get_async_session():
            res = await db.execute(select(MessageModel).where(MessageModel.id == message_id))
            msg = res.scalar_one_or_none()
            if not msg:
                raise HTTPException(status_code=404, detail="Message not found")
            if str(msg.sender_id) != str(auth["user_id"]):
                raise HTTPException(status_code=403, detail="Not your message")
            msg.content = payload.content
            msg.is_edited = True
            msg.updated_at = datetime.utcnow()
            await db.commit()
            return {"ok": True, "message": msg.to_dict() if hasattr(msg, "to_dict") else {"id": message_id}}
    except HTTPException:
        raise
    except Exception as e:
        logger.warning("edit_message error: %s", e)
        raise HTTPException(status_code=500, detail="Failed to edit message")


@v2_chat_router.delete("/messages/{message_id}")
async def delete_message(
    message_id: str,
    auth: dict = Depends(get_bot_or_api_key_user),
):
    """Delete a message."""
    try:
        from app.core.database import get_async_session
        from app.models.message import Message as MessageModel
        from sqlalchemy import select

        async for db in get_async_session():
            res = await db.execute(select(MessageModel).where(MessageModel.id == message_id))
            msg = res.scalar_one_or_none()
            if not msg:
                raise HTTPException(status_code=404, detail="Message not found")
            if str(msg.sender_id) != str(auth["user_id"]):
                raise HTTPException(status_code=403, detail="Not your message")
            await db.delete(msg)
            await db.commit()
            return {"ok": True}
    except HTTPException:
        raise
    except Exception as e:
        logger.warning("delete_message error: %s", e)
        raise HTTPException(status_code=500, detail="Failed to delete message")


@v2_chat_router.post("/messages/{message_id}/reaction")
async def add_reaction(
    message_id: str,
    payload: ReactionSchema,
    auth: dict = Depends(get_bot_or_api_key_user),
):
    """Add or toggle a reaction on a message."""
    if not payload.emoji:
        raise HTTPException(status_code=400, detail="emoji required")

    try:
        from app.core.database import get_async_session
        from app.models.message import Message as MessageModel
        from sqlalchemy import select

        async for db in get_async_session():
            res = await db.execute(select(MessageModel).where(MessageModel.id == message_id))
            msg = res.scalar_one_or_none()
            if not msg:
                raise HTTPException(status_code=404, detail="Message not found")

            reactions = list(msg.reactions or [])
            user_reaction = next(
                (r for r in reactions if r.get("user_id") == auth["user_id"] and r.get("emoji") == payload.emoji),
                None,
            )

            if user_reaction:
                reactions = [r for r in reactions if not (r.get("user_id") == auth["user_id"] and r.get("emoji") == payload.emoji)]
                action = "removed"
            else:
                reactions.append({
                    "user_id": auth["user_id"],
                    "emoji": payload.emoji,
                    "created_at": datetime.utcnow().isoformat(),
                })
                action = "added"

            msg.reactions = reactions
            await db.commit()
            return {"ok": True, "action": action, "reactions": reactions}
    except HTTPException:
        raise
    except Exception as e:
        logger.warning("add_reaction error: %s", e)
        raise HTTPException(status_code=500, detail="Failed to update reaction")


@v2_chat_router.get("/conversations")
async def get_conversations(
    limit: int = Query(30, ge=1, le=100),
    auth: dict = Depends(get_bot_or_api_key_user),
):
    """Get recent conversations (DM contacts)."""
    try:
        from app.services.message_service import MessageService
        contacts = MessageService.get_recent_contacts(auth["user_id"], limit=limit)
        return {"ok": True, "conversations": contacts}
    except Exception as e:
        logger.warning("get_conversations error: %s", e)
        return {"ok": True, "conversations": []}


@v2_chat_router.post("/forward")
async def forward_messages(
    payload: ForwardMessageSchema,
    auth: dict = Depends(get_bot_or_api_key_user),
):
    """Forward messages to another chat."""
    if not payload.to_chat_id or not payload.message_ids:
        raise HTTPException(status_code=400, detail="to_chat_id and message_ids required")

    try:
        from app.core.database import get_async_session
        from app.models.message import Message as MessageModel
        from sqlalchemy import select

        forwarded = []
        async for db in get_async_session():
            for mid in payload.message_ids:
                res = await db.execute(select(MessageModel).where(MessageModel.id == mid))
                msg = res.scalar_one_or_none()
                if msg:
                    new_msg = MessageModel(
                        id=str(uuid.uuid4()),
                        sender_id=auth["user_id"],
                        target_id=payload.to_chat_id,
                        content=msg.content,
                        type=msg.type,
                        attachments=msg.attachments,
                        forwarded_from_id=msg.sender_id,
                        timestamp=datetime.utcnow(),
                    )
                    db.add(new_msg)
                    forwarded.append(new_msg.id)
            await db.commit()

        return {"ok": True, "forwarded": forwarded}
    except HTTPException:
        raise
    except Exception as e:
        logger.warning("forward_messages error: %s", e)
        raise HTTPException(status_code=500, detail="Failed to forward messages")
