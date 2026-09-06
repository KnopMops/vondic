import hashlib
import json
import time
from datetime import datetime
from typing import Optional, List, Dict, Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import select


def _parse_attachments(raw) -> list:
    """Parse attachments from DB (JSON string or list) to a list."""
    if not raw:
        return []
    if isinstance(raw, list):
        return raw
    if isinstance(raw, str):
        try:
            parsed = json.loads(raw)
            return parsed if isinstance(parsed, list) else []
        except (json.JSONDecodeError, ValueError):
            return []
    return []


def _ts(dt) -> int:
    """Convert datetime to Unix timestamp (seconds)."""
    if not dt:
        return 0
    return int(dt.timestamp())

from app.core.database import get_async_db
from app.core.deps import get_current_user, get_optional_current_user
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


@support_router.get("/notifications/updates")
async def get_notification_updates(
    current_user: Optional[User] = Depends(get_optional_current_user),
    db=Depends(get_async_db)
):
    if not current_user:
        return {"unread_count": 0, "updates": []}
    res = await db.execute(
        select(Notification)
        .where(Notification.user_id == current_user.id, Notification.is_read == 0)
        .limit(20)
    )
    items = res.scalars().all()
    return {"unread_count": len(items), "updates": [n.to_dict() if hasattr(n, "to_dict") else {"id": n.id} for n in items]}


@support_router.get("/messenger/chats")
@support_router.post("/messenger/chats")
async def support_messenger_chats(
    current_user: Optional[User] = Depends(get_optional_current_user),
    db=Depends(get_async_db)
):
    return {"chats": [], "unread_count": 0}


# ── Admin: Escalations ────────────────────────────────────────────

@support_router.get("/admin/escalations/{esc_id}/messages")
async def admin_escalation_messages(
    esc_id: int,
    current_user=Depends(get_current_user),
    db=Depends(get_async_db),
):
    role = (getattr(current_user, "role", "") or "").lower()
    if role not in ("admin", "support"):
        raise HTTPException(status_code=403, detail="Forbidden")

    res = await db.execute(
        select(SupportChatMessage)
        .where(SupportChatMessage.escalation_id == esc_id)
        .order_by(SupportChatMessage.created_at.asc())
    )
    items = res.scalars().all()
    return {
        "ok": True,
        "messages": [
            {
                "id": m.id,
                "escalation_id": m.escalation_id,
                "sender": m.sender,
                "content": m.content,
                "created_at": _ts(m.created_at),
            }
            for m in items
        ],
    }


@support_router.get("/admin/escalations/{esc_id}/updates")
async def admin_escalation_updates(
    esc_id: int,
    since_id: Optional[int] = Query(None),
    current_user=Depends(get_current_user),
    db=Depends(get_async_db),
):
    role = (getattr(current_user, "role", "") or "").lower()
    if role not in ("admin", "support"):
        raise HTTPException(status_code=403, detail="Forbidden")

    stmt = select(SupportChatMessage).where(SupportChatMessage.escalation_id == esc_id)
    if since_id:
        stmt = stmt.where(SupportChatMessage.id > since_id)
    stmt = stmt.order_by(SupportChatMessage.id.asc())
    res = await db.execute(stmt)
    items = res.scalars().all()
    return {
        "ok": True,
        "messages": [
            {
                "id": m.id,
                "escalation_id": m.escalation_id,
                "sender": m.sender,
                "content": m.content,
                "created_at": _ts(m.created_at),
            }
            for m in items
        ],
    }


class AdminEscalationAnswerSchema(BaseModel):
    answer: str


@support_router.post("/admin/escalations/{esc_id}/answer")
async def admin_escalation_answer(
    esc_id: int,
    payload: AdminEscalationAnswerSchema,
    current_user=Depends(get_current_user),
    db=Depends(get_async_db),
):
    role = (getattr(current_user, "role", "") or "").lower()
    if role not in ("admin", "support"):
        raise HTTPException(status_code=403, detail="Forbidden")

    res = await db.execute(select(Escalation).where(Escalation.id == esc_id))
    esc = res.scalar_one_or_none()
    if not esc:
        raise HTTPException(status_code=404, detail="Escalation not found")

    esc.status = "answered"
    esc.answered_at = datetime.utcnow()

    msg = SupportChatMessage(
        escalation_id=esc.id,
        sender="operator",
        content=payload.answer,
        created_at=datetime.utcnow(),
    )
    db.add(msg)
    await db.commit()
    return {"ok": True, "message": "Escalation answered"}


@support_router.post("/admin/escalations/{esc_id}/close")
async def admin_escalation_close(
    esc_id: int,
    current_user=Depends(get_current_user),
    db=Depends(get_async_db),
):
    role = (getattr(current_user, "role", "") or "").lower()
    if role not in ("admin", "support"):
        raise HTTPException(status_code=403, detail="Forbidden")

    res = await db.execute(select(Escalation).where(Escalation.id == esc_id))
    esc = res.scalar_one_or_none()
    if not esc:
        raise HTTPException(status_code=404, detail="Escalation not found")

    esc.status = "closed"
    if not esc.answered_at:
        esc.answered_at = datetime.utcnow()
    await db.commit()
    return {"ok": True, "message": "Escalation closed"}


@support_router.get("/admin/escalations")
async def admin_list_escalations(
    status: Optional[str] = Query(None),
    current_user=Depends(get_current_user),
    db=Depends(get_async_db),
):
    role = (getattr(current_user, "role", "") or "").lower()
    if role not in ("admin", "support"):
        raise HTTPException(status_code=403, detail="Forbidden")

    stmt = select(Escalation)
    if status:
        stmt = stmt.where(Escalation.status == status)
    else:
        # By default exclude closed tickets
        stmt = stmt.where(Escalation.status != "closed")
    res = await db.execute(stmt.order_by(Escalation.created_at.desc()))
    items = res.scalars().all()
    return {
        "ok": True,
        "escalations": [
            {
                "id": e.id,
                "user_id": e.user_id,
                "question": e.question,
                "status": e.status,
                "created_at": _ts(e.created_at),
                "answered_at": _ts(e.answered_at),
            }
            for e in items
        ],
    }


# ── Admin: Post Reports ───────────────────────────────────────────

@support_router.get("/admin/post-reports")
async def admin_list_post_reports(
    status_filter: Optional[str] = Query(None, alias="status"),
    current_user=Depends(get_current_user),
    db=Depends(get_async_db),
):
    role = (getattr(current_user, "role", "") or "").lower()
    if role not in ("admin", "support"):
        raise HTTPException(status_code=403, detail="Forbidden")

    query = select(PostReport).order_by(PostReport.created_at.desc())
    if status_filter:
        query = query.where(PostReport.status == status_filter)
    else:
        query = query.where(PostReport.status == "open")
    res = await db.execute(query)
    items = res.scalars().all()
    return {
        "ok": True,
        "reports": [
            {
                "id": r.id,
                "reporter_id": r.reporter_id,
                "reporter_login": r.reporter_login,
                "post_id": r.post_id,
                "post_author_login": r.post_author_login,
                "description": r.description,
                "reason": r.reason,
                "attachments": _parse_attachments(r.attachments),
                "status": r.status,
                "created_at": _ts(r.created_at),
                "verdict_at": r.verdict_at,
            }
            for r in items
        ],
    }


class PostReportActionSchema(BaseModel):
    action: str
    post_id: Optional[str] = None
    report_id: Optional[int] = None
    reason: Optional[str] = None


@support_router.post("/admin/post-reports/action")
async def admin_post_report_action(
    payload: PostReportActionSchema,
    current_user=Depends(get_current_user),
    db=Depends(get_async_db),
):
    role = (getattr(current_user, "role", "") or "").lower()
    if role not in ("admin", "support"):
        raise HTTPException(status_code=403, detail="Forbidden")

    action = payload.action

    # Mark report as resolved if report_id provided
    if payload.report_id is not None:
        res = await db.execute(select(PostReport).where(PostReport.id == payload.report_id))
        report = res.scalar_one_or_none()
        if report:
            if action == "no_violation":
                report.status = "no_violation"
                report.verdict_at = int(time.time())
            elif action in ("request_removal", "force_remove", "legal_remove"):
                report.status = action
                report.verdict_at = int(time.time())

    # Delete the post if force_remove or legal_remove
    removed = False
    if action in ("force_remove", "legal_remove") and payload.post_id:
        from app.models.post import Post
        res = await db.execute(select(Post).where(Post.id == payload.post_id))
        post = res.scalar_one_or_none()
        if post:
            await db.delete(post)
            removed = True

    await db.commit()
    return {"ok": True, "removed": removed, "status": action}


# ── Admin: User Reports ───────────────────────────────────────────

@support_router.get("/admin/user-reports")
async def admin_list_user_reports(
    status_filter: Optional[str] = Query(None, alias="status"),
    current_user=Depends(get_current_user),
    db=Depends(get_async_db),
):
    role = (getattr(current_user, "role", "") or "").lower()
    if role not in ("admin", "support"):
        raise HTTPException(status_code=403, detail="Forbidden")

    query = select(UserReport).order_by(UserReport.created_at.desc())
    if status_filter:
        query = query.where(UserReport.status == status_filter)
    else:
        query = query.where(UserReport.status == "open")
    res = await db.execute(query)
    items = res.scalars().all()
    return {
        "ok": True,
        "reports": [
            {
                "id": r.id,
                "reporter_id": r.reporter_id,
                "reporter_login": r.reporter_login,
                "target_user_id": r.target_user_id,
                "target_user_login": r.target_user_login,
                "description": r.description,
                "attachments": _parse_attachments(r.attachments),
                "status": r.status,
                "created_at": _ts(r.created_at),
                "verdict_at": r.verdict_at,
            }
            for r in items
        ],
    }


class UserReportActionSchema(BaseModel):
    action: str
    report_id: int


@support_router.post("/admin/user-reports/action")
async def admin_user_report_action(
    payload: UserReportActionSchema,
    current_user=Depends(get_current_user),
    db=Depends(get_async_db),
):
    role = (getattr(current_user, "role", "") or "").lower()
    if role not in ("admin", "support"):
        raise HTTPException(status_code=403, detail="Forbidden")

    res = await db.execute(select(UserReport).where(UserReport.id == payload.report_id))
    report = res.scalar_one_or_none()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    action = payload.action
    if action == "no_violation":
        report.status = "no_violation"
        report.verdict_at = int(time.time())
    elif action == "close":
        report.status = "closed"
        report.verdict_at = int(time.time())
    elif action == "reset_username":
        # Reset the reported user's username
        target_id = report.target_user_id
        if target_id:
            user_res = await db.execute(select(User).where(User.id == target_id))
            target_user = user_res.scalar_one_or_none()
            if target_user:
                target_user.username = f"user_{target_user.id[:8]}"
        report.status = "resolved"
        report.verdict_at = int(time.time())

    await db.commit()
    return {"ok": True}
