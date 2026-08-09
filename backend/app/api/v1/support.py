import hashlib
import time
from datetime import datetime
from typing import Optional, List, Dict, Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import select

from app.core.database import get_async_db
from app.core.deps import get_current_user
from app.models.escalation import Escalation
from app.models.notification import Notification
from app.models.post_report import PostReport
from app.models.user_report import UserReport
from app.models.support_chat_message import SupportChatMessage
from app.models.user import User

support_router = APIRouter(prefix="/api/v1/support", tags=["Support"])


class SupportAskSchema(BaseModel):
    question: str


class EscalationAnswerSchema(BaseModel):
    escalation_id: int
    answer: str


class SupportChatMessageSchema(BaseModel):
    escalation_id: int
    content: str


@support_router.post("/ask")
async def ask_support(
    payload: SupportAskSchema,
    current_user=Depends(get_current_user),
    db=Depends(get_async_db)
):
    question = payload.question.strip()
    if not question:
        raise HTTPException(status_code=400, detail="Question is required")

    escalation = Escalation(
        user_id=current_user.id,
        question=question,
        status="open",
        created_at=datetime.utcnow(),
    )
    db.add(escalation)
    await db.commit()

    return {
        "answer": "Ваше обращение зарегистрировано. Оператор ответит вам в ближайшее время.",
        "escalation_created": True,
        "escalation_id": escalation.id,
    }


@support_router.get("/escalations")
async def list_escalations(
    status_filter: Optional[str] = Query("open"),
    current_user=Depends(get_current_user),
    db=Depends(get_async_db)
):
    stmt = select(Escalation)
    if status_filter:
        stmt = stmt.where(Escalation.status == status_filter)
    res = await db.execute(stmt.order_by(Escalation.created_at.desc()))
    items = res.scalars().all()
    return [{"id": e.id, "user_id": e.user_id, "question": e.question, "status": e.status, "created_at": e.created_at.isoformat()} for e in items]


@support_router.post("/escalations/answer")
async def answer_escalation(
    payload: EscalationAnswerSchema,
    current_user=Depends(get_current_user),
    db=Depends(get_async_db)
):
    res = await db.execute(select(Escalation).where(Escalation.id == payload.escalation_id))
    esc = res.scalar_one_or_none()
    if not esc:
        raise HTTPException(status_code=404, detail="Escalation not found")

    esc.status = "closed"
    esc.answered_at = datetime.utcnow()

    msg = SupportChatMessage(
        escalation_id=esc.id,
        sender="operator",
        content=payload.answer,
        created_at=datetime.utcnow()
    )
    db.add(msg)
    await db.commit()
    return {"message": "Escalation answered"}
