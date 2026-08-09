from datetime import datetime
from typing import Optional, List, Dict, Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import select

from app.core.database import get_async_db
from app.core.deps import get_current_user
from app.models.message import Message
from app.services.message_service import MessageService

messages_router = APIRouter(prefix="/api/v1/messages", tags=["Messages"])


class ReactionSchema(BaseModel):
    emoji: str


class MessageEditSchema(BaseModel):
    content: str


class MessageSendSchema(BaseModel):
    target_user_id: Optional[str] = None
    channel_id: Optional[str] = None
    group_id: Optional[str] = None
    content: str
    type: Optional[str] = "text"
    attachments: Optional[List[Dict[str, Any]]] = None


@messages_router.post("/{message_id}/reaction")
async def add_reaction(
    message_id: str,
    payload: ReactionSchema,
    current_user=Depends(get_current_user),
    db=Depends(get_async_db)
):
    emoji = payload.emoji
    if not emoji:
        raise HTTPException(status_code=400, detail="emoji is required")

    res = await db.execute(select(Message).where(Message.id == message_id))
    message = res.scalar_one_or_none()
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")

    reactions = list(message.reactions or [])
    user_reaction = next((r for r in reactions if r.get("user_id") == current_user.id and r.get("emoji") == emoji), None)

    if user_reaction:
        reactions = [r for r in reactions if r.get("user_id") != current_user.id or r.get("emoji") != emoji]
        action = "removed"
    else:
        reactions.append({
            "user_id": current_user.id,
            "username": current_user.username,
            "emoji": emoji,
            "created_at": datetime.utcnow().isoformat()
        })
        action = "added"

    message.reactions = reactions
    await db.commit()
    return {
        "success": True,
        "reactions": reactions,
        "action": action
    }


@messages_router.put("/{message_id}/edit")
async def edit_message(
    message_id: str,
    payload: MessageEditSchema,
    current_user=Depends(get_current_user),
    db=Depends(get_async_db)
):
    new_content = payload.content
    if not new_content:
        raise HTTPException(status_code=400, detail="Content is required")

    res = await db.execute(select(Message).where(Message.id == message_id))
    message = res.scalar_one_or_none()
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")

    if message.sender_id != current_user.id:
        raise HTTPException(status_code=403, detail="Forbidden")

    message.content = new_content
    message.is_edited = True
    message.updated_at = datetime.utcnow()
    await db.commit()
    return {"success": True, "message": message.to_dict()}


@messages_router.delete("/{message_id}")
async def delete_message(
    message_id: str,
    for_everyone: bool = Query(True),
    current_user=Depends(get_current_user),
    db=Depends(get_async_db)
):
    res = await db.execute(select(Message).where(Message.id == message_id))
    message = res.scalar_one_or_none()
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")

    if message.sender_id != current_user.id:
        raise HTTPException(status_code=403, detail="Forbidden")

    await db.delete(message)
    await db.commit()
    return {"success": True, "message": "Message deleted"}


@messages_router.post("", status_code=status.HTTP_201_CREATED)
@messages_router.post("/", status_code=status.HTTP_201_CREATED)
async def send_message(
    payload: MessageSendSchema,
    current_user=Depends(get_current_user)
):
    msg, err = MessageService.send_message(
        sender_id=current_user.id,
        target_user_id=payload.target_user_id,
        channel_id=payload.channel_id,
        group_id=payload.group_id,
        content=payload.content,
        msg_type=payload.type or "text",
        attachments=payload.attachments
    )
    if err or not msg:
        raise HTTPException(status_code=400, detail=err or "Failed to send message")
    return {"message": msg.to_dict(), "success": True}
