import uuid
from datetime import datetime
from typing import Optional, List, Dict, Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select

from app.core.database import get_async_db
from app.core.deps import get_current_user
from app.models.scheduled_message import ScheduledMessage

scheduled_router = APIRouter(prefix="/api/v1/scheduled-messages", tags=["Scheduled Messages"])


class ScheduledMessageCreateSchema(BaseModel):
    content: str
    scheduled_at: str
    target_user_id: Optional[str] = None
    channel_id: Optional[str] = None
    group_id: Optional[str] = None
    type: Optional[str] = "text"
    attachments: Optional[List[Dict[str, Any]]] = None


@scheduled_router.post("", status_code=status.HTTP_201_CREATED)
@scheduled_router.post("/", status_code=status.HTTP_201_CREATED)
async def create_scheduled(
    payload: ScheduledMessageCreateSchema,
    current_user=Depends(get_current_user),
    db=Depends(get_async_db)
):
    try:
        dt = datetime.fromisoformat(payload.scheduled_at.replace("Z", "+00:00")).replace(tzinfo=None)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid scheduled_at format")

    if dt <= datetime.utcnow():
        raise HTTPException(status_code=400, detail="scheduled_at must be in the future")

    msg = ScheduledMessage(
        id=uuid.uuid4().hex[:16],
        sender_id=str(current_user.id),
        target_user_id=payload.target_user_id,
        channel_id=payload.channel_id,
        group_id=payload.group_id,
        content=payload.content.strip(),
        type=payload.type or "text",
        attachments=payload.attachments,
        scheduled_at=dt,
    )
    db.add(msg)
    await db.commit()
    return msg.to_dict()


@scheduled_router.get("")
@scheduled_router.get("/")
@scheduled_router.get("/chat")
@scheduled_router.post("/chat")
@scheduled_router.get("/chat/{chat_id}")
@scheduled_router.post("/chat/{chat_id}")
async def list_scheduled(
    chat_id: Optional[str] = None,
    current_user=Depends(get_current_user),
    db=Depends(get_async_db)
):
    res = await db.execute(
        select(ScheduledMessage)
        .where(ScheduledMessage.sender_id == str(current_user.id), ScheduledMessage.sent_at == None)
        .order_by(ScheduledMessage.scheduled_at.asc())
    )
    msgs = res.scalars().all()
    items = [m.to_dict() for m in msgs]
    return {"scheduled_messages": items, "messages": items} if isinstance(items, list) else items



@scheduled_router.delete("/{msg_id}")
async def cancel_scheduled(
    msg_id: str,
    current_user=Depends(get_current_user),
    db=Depends(get_async_db)
):
    res = await db.execute(
        select(ScheduledMessage).where(
            ScheduledMessage.id == msg_id,
            ScheduledMessage.sender_id == str(current_user.id),
            ScheduledMessage.sent_at == None
        )
    )
    msg = res.scalar_one_or_none()
    if not msg:
        raise HTTPException(status_code=404, detail="Scheduled message not found")

    await db.delete(msg)
    await db.commit()
    return {"ok": True}
