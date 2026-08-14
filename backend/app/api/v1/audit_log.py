from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select

from app.core.database import get_async_db
from app.core.deps import get_current_user
from app.models.audit_log import AuditLog

audit_log_router = APIRouter(prefix="/api/v1/audit-log", tags=["Audit Log"])


async def log_audit_async(db, user_id: str, action: str, group_id: str = None, channel_id: str = None,
                          target_user_id: str = None, details: dict = None):
    try:
        entry = AuditLog(
            user_id=user_id, action=action, group_id=group_id,
            channel_id=channel_id, target_user_id=target_user_id, details=details,
        )
        db.add(entry)
        await db.commit()
    except Exception:
        pass


@audit_log_router.get("")
@audit_log_router.get("/")
async def list_audit(
    group_id: Optional[str] = Query(None),
    channel_id: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    current_user=Depends(get_current_user),
    db=Depends(get_async_db)
):
    if not group_id and not channel_id:
        raise HTTPException(status_code=400, detail="group_id or channel_id required")

    stmt = select(AuditLog)
    if group_id:
        stmt = stmt.where(AuditLog.group_id == group_id)
    else:
        stmt = stmt.where(AuditLog.channel_id == channel_id)

    res = await db.execute(stmt.order_by(AuditLog.created_at.desc()).limit(limit))
    logs = res.scalars().all()
    return [l.to_dict() for l in logs]
