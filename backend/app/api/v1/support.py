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
@support_router.get("/chats")
@support_router.post("/chats")
async def support_messenger_chats(
    current_user: Optional[User] = Depends(get_optional_current_user),
    db=Depends(get_async_db)
):
    if not current_user:
        return {"chats": [], "unread_count": 0}
    res = await db.execute(
        select(Escalation)
        .where(Escalation.user_id == str(current_user.id))
        .order_by(Escalation.created_at.desc())
    )
    rows = res.scalars().all()
    result = []
    total_unread = 0
    for r in rows:
        res_msg = await db.execute(
            select(SupportChatMessage)
            .where(SupportChatMessage.escalation_id == r.id)
            .order_by(SupportChatMessage.created_at.desc())
        )
        last_msg = res_msg.scalars().first()
        res_un = await db.execute(
            select(SupportChatMessage)
            .where(
                SupportChatMessage.escalation_id == r.id,
                SupportChatMessage.sender != "user",
                SupportChatMessage.read.is_(False),
            )
        )
        unread = len(res_un.scalars().all())
        total_unread += unread
        result.append({
            "id": r.id,
            "question": r.question,
            "status": r.status or "open",
            "created_at": r.created_at.isoformat() if r.created_at else None,
            "last_message": last_msg.content if last_msg else r.question,
            "last_message_at": last_msg.created_at.isoformat() if last_msg and last_msg.created_at else (r.created_at.isoformat() if r.created_at else None),
            "last_sender": last_msg.sender if last_msg else "user",
            "unread_count": unread,
        })
    return {"ok": True, "chats": result, "unread_count": total_unread}


@support_router.post("/chats/{esc_id}/delete")
@support_router.delete("/chats/{esc_id}")
@support_router.post("/chats/delete")
async def delete_chat(
    esc_id: Optional[int] = None,
    payload: Optional[Dict[str, Any]] = None,
    current_user=Depends(get_current_user),
    db=Depends(get_async_db)
):
    target_id = esc_id or (payload.get("escalation_id") if payload else None) or (payload.get("esc_id") if payload else None) or (payload.get("id") if payload else None)
    if not target_id:
        raise HTTPException(status_code=400, detail="escalation_id is required")
    res = await db.execute(select(Escalation).where(Escalation.id == int(target_id)))
    esc = res.scalar_one_or_none()
    if not esc:
        raise HTTPException(status_code=404, detail="Not found")
    is_admin = getattr(current_user, "role", "").lower() in ("admin", "support")
    if not is_admin and str(esc.user_id) != str(current_user.id):
        raise HTTPException(status_code=403, detail="Forbidden")
    from sqlalchemy import delete
    await db.execute(delete(SupportChatMessage).where(SupportChatMessage.escalation_id == int(target_id)))
    await db.delete(esc)
    await db.commit()
    return {"ok": True, "message": "Chat deleted"}


@support_router.get("/messenger/{esc_id}/messages")
async def messenger_escalation_messages(
    esc_id: int,
    since_id: int = Query(0),
    current_user: User = Depends(get_current_user),
    db=Depends(get_async_db),
):
    res = await db.execute(select(Escalation).where(Escalation.id == esc_id))
    escalation = res.scalar_one_or_none()
    if not escalation:
        raise HTTPException(status_code=404, detail="Escalation not found")
    role = (getattr(current_user, "role", "") or "").lower()
    is_support = role in ("support", "admin")
    if not is_support and str(escalation.user_id) != str(current_user.id):
        raise HTTPException(status_code=403, detail="Forbidden")

    stmt = select(SupportChatMessage).where(SupportChatMessage.escalation_id == esc_id)
    if since_id > 0:
        stmt = stmt.where(SupportChatMessage.id > since_id)
    res_m = await db.execute(stmt.order_by(SupportChatMessage.created_at.asc()))
    rows = res_m.scalars().all()

    messages = [
        {
            "id": r.id,
            "sender": r.sender or "admin",
            "content": r.content,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in rows
    ]
    if not is_support and rows:
        for r in rows:
            if r.sender != "user" and not r.read:
                r.read = True
        await db.commit()

    return {
        "ok": True,
        "messages": messages,
        "status": escalation.status or "open",
    }


@support_router.post("/messenger/{esc_id}/send")
async def messenger_send(
    esc_id: int,
    payload: Dict[str, Any],
    current_user: User = Depends(get_current_user),
    db=Depends(get_async_db),
):
    content = str(payload.get("message") or payload.get("content") or "").strip()
    if not content:
        raise HTTPException(status_code=400, detail="Empty message")

    res = await db.execute(select(Escalation).where(Escalation.id == esc_id))
    escalation = res.scalar_one_or_none()
    if not escalation:
        raise HTTPException(status_code=404, detail="Escalation not found")

    role = (getattr(current_user, "role", "") or "").lower()
    is_support = role in ("support", "admin")
    if not is_support and str(escalation.user_id) != str(current_user.id):
        raise HTTPException(status_code=403, detail="Forbidden")
    if (escalation.status or "").lower() == "closed":
        raise HTTPException(status_code=400, detail="Chat is closed")

    sender = "support" if is_support else "user"
    msg = SupportChatMessage(
        escalation_id=esc_id,
        sender=sender,
        content=content,
        created_at=datetime.utcnow(),
    )
    db.add(msg)
    if is_support:
        escalation.status = "answered"
        escalation.answered_at = datetime.utcnow()
    await db.commit()
    return {
        "ok": True,
        "id": msg.id,
        "sender": sender,
        "created_at": msg.created_at.isoformat() if msg.created_at else None,
    }



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


@support_router.post("/post-reports")
async def create_post_report(
    payload: Dict[str, Any],
    current_user: User = Depends(get_current_user),
    db=Depends(get_async_db)
):
    post_id = str(payload.get("post_id") or "").strip()
    post_author_login = str(payload.get("post_author_login") or "").strip()
    description = str(payload.get("description") or payload.get("reason") or "").strip()
    attachments = payload.get("attachments") or []
    if not post_id or not description:
        raise HTTPException(status_code=400, detail="post_id and description are required")
    report = PostReport(
        reporter_id=str(current_user.id),
        reporter_login=str(current_user.username or ""),
        post_id=post_id,
        post_author_login=post_author_login or "unknown",
        description=description,
        attachments=json.dumps(attachments) if isinstance(attachments, list) else str(attachments),
        status="pending",
        created_at=datetime.utcnow(),
    )
    db.add(report)
    await db.commit()
    return {"ok": True, "id": report.id}


@support_router.post("/user-reports")
async def create_user_report(
    payload: Dict[str, Any],
    current_user: User = Depends(get_current_user),
    db=Depends(get_async_db)
):
    target_user_id = str(payload.get("target_user_id") or payload.get("user_id") or "").strip()
    target_user_login = str(payload.get("target_user_login") or payload.get("username") or "").strip()
    description = str(payload.get("description") or payload.get("reason") or "").strip()
    attachments = payload.get("attachments") or []
    if not target_user_id or not description:
        raise HTTPException(status_code=400, detail="target_user_id and description are required")
    report = UserReport(
        reporter_id=str(current_user.id),
        reporter_login=str(current_user.username or ""),
        target_user_id=target_user_id,
        target_user_login=target_user_login or None,
        description=description,
        attachments=json.dumps(attachments) if isinstance(attachments, list) else str(attachments),
        status="pending",
        created_at=datetime.utcnow(),
    )
    db.add(report)
    await db.commit()
    return {"ok": True, "id": report.id}


@support_router.post("/anon/create")
async def anon_create(
    payload: Dict[str, Any],
    db=Depends(get_async_db)
):
    import uuid as _uuid
    question = str(payload.get("question") or payload.get("message") or "").strip()
    if not question:
        raise HTTPException(status_code=400, detail="Empty message")
    anon_token = _uuid.uuid4().hex
    user_id = f"anon:{anon_token}"
    esc = Escalation(
        user_id=user_id,
        question=question,
        status="open",
        created_at=datetime.utcnow(),
    )
    db.add(esc)
    await db.flush()

    msg = SupportChatMessage(
        escalation_id=esc.id,
        sender="user",
        content=question,
        created_at=datetime.utcnow(),
    )
    db.add(msg)
    await db.commit()
    return {
        "ok": True,
        "escalation_id": esc.id,
        "anon_token": anon_token,
    }


@support_router.get("/anon/{esc_id}/messages")
async def anon_messages(
    esc_id: int,
    token: str = Query(...),
    since_id: int = Query(0),
    db=Depends(get_async_db)
):
    res = await db.execute(select(Escalation).where(Escalation.id == esc_id))
    escalation = res.scalar_one_or_none()
    if not escalation:
        raise HTTPException(status_code=404, detail="Not found")
    if escalation.user_id != f"anon:{token}":
        raise HTTPException(status_code=403, detail="Forbidden")

    stmt = select(SupportChatMessage).where(SupportChatMessage.escalation_id == esc_id)
    if since_id > 0:
        stmt = stmt.where(SupportChatMessage.id > since_id)
    res_m = await db.execute(stmt.order_by(SupportChatMessage.created_at.asc()))
    rows = res_m.scalars().all()

    messages = [
        {
            "id": r.id,
            "sender": r.sender or "admin",
            "content": r.content,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in rows
    ]
    for r in rows:
        if r.sender != "user" and not r.read:
            r.read = True
    await db.commit()
    return {
        "ok": True,
        "messages": messages,
        "status": escalation.status or "open",
    }


@support_router.post("/anon/{esc_id}/send")
async def anon_send(
    esc_id: int,
    payload: Dict[str, Any],
    db=Depends(get_async_db)
):
    token = payload.get("token")
    content = str(payload.get("message") or payload.get("content") or "").strip()
    if not token:
        raise HTTPException(status_code=400, detail="token is required")
    if not content:
        raise HTTPException(status_code=400, detail="Empty message")

    res = await db.execute(select(Escalation).where(Escalation.id == esc_id))
    escalation = res.scalar_one_or_none()
    if not escalation:
        raise HTTPException(status_code=404, detail="Not found")
    if escalation.user_id != f"anon:{token}":
        raise HTTPException(status_code=403, detail="Forbidden")
    if (escalation.status or "").lower() == "closed":
        raise HTTPException(status_code=400, detail="Chat closed")

    msg = SupportChatMessage(
        escalation_id=esc_id,
        sender="user",
        content=content,
        created_at=datetime.utcnow(),
    )
    db.add(msg)
    await db.commit()
    return {"ok": True}


@support_router.get("/anon/{esc_id}/check")
async def anon_check(
    esc_id: int,
    token: str = Query(...),
    db=Depends(get_async_db)
):
    res = await db.execute(select(Escalation).where(Escalation.id == esc_id))
    escalation = res.scalar_one_or_none()
    if not escalation:
        raise HTTPException(status_code=404, detail="Not found")
    if escalation.user_id != f"anon:{token}":
        raise HTTPException(status_code=403, detail="Forbidden")
    return {
        "ok": True,
        "status": escalation.status or "open",
        "question": escalation.question,
        "created_at": escalation.created_at.isoformat() if escalation.created_at else None,
    }


@support_router.post("/chat/send")
async def chat_send(
    payload: Dict[str, Any],
    current_user=Depends(get_current_user),
    db=Depends(get_async_db)
):
    question = (payload.get("question") or payload.get("message") or payload.get("content") or "").strip()
    return await ask_support(SupportAskSchema(question=question), current_user=current_user, db=db)


@support_router.get("/chat/history")
async def chat_history(
    current_user=Depends(get_current_user),
    db=Depends(get_async_db)
):
    return await support_messenger_chats(current_user=current_user, db=db)


@support_router.get("/chat/updates")
async def chat_updates(
    since: Optional[int] = Query(None),
    current_user=Depends(get_current_user),
    db=Depends(get_async_db)
):
    return await support_notifications_updates(since=since, current_user=current_user, db=db)

