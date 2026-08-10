import os
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import or_, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_async_session
from app.core.deps import get_current_user, get_optional_current_user
from app.models.user import User

users_router = APIRouter(prefix="/api/v1/users", tags=["Users"])


@users_router.get("")
@users_router.get("/")
async def get_users(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session),
):
    stmt = select(User).limit(100)
    res = await db.execute(stmt)
    users = res.scalars().all()
    return [u.to_dict(viewer_id=current_user.id) for u in users]


@users_router.get("/me")
async def get_me(
    current_user: User = Depends(get_current_user),
):
    return current_user.to_dict(viewer_id=current_user.id)


@users_router.put("/me")
async def update_me(
    payload: Dict[str, Any],
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session),
):
    allowed_fields = {"username", "description", "avatar_url", "profile_bg_theme", "profile_bg_gradient", "profile_bg_image", "privacy_settings"}
    for k, v in payload.items():
        if k in allowed_fields:
            setattr(current_user, k, v)
    await db.commit()
    return current_user.to_dict(viewer_id=current_user.id)


@users_router.post("/get")
async def get_user_detail(
    payload: Dict[str, Any],
    optional_user: Optional[User] = Depends(get_optional_current_user),
    db: AsyncSession = Depends(get_async_session),
):
    user_id = payload.get("user_id")
    if not user_id:
        raise HTTPException(status_code=400, detail="Требуется user_id")

    stmt = select(User).where(User.id == str(user_id))
    res = await db.execute(stmt)
    user = res.scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail="USER_NOT_FOUND")

    viewer_id = optional_user.id if optional_user else None
    return user.to_dict(viewer_id=viewer_id)


@users_router.get("/by-email/{email}")
async def get_user_by_email(
    email: str,
    optional_user: Optional[User] = Depends(get_optional_current_user),
    db: AsyncSession = Depends(get_async_session),
):
    stmt = select(User).where(User.email == email)
    res = await db.execute(stmt)
    user = res.scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail="USER_NOT_FOUND")

    viewer_id = optional_user.id if optional_user else None
    return user.to_dict(viewer_id=viewer_id)


@users_router.post("/search")
async def search_users(
    payload: Dict[str, Any],
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session),
):
    query = payload.get("query", "").strip()
    if not query:
        raise HTTPException(status_code=400, detail="Требуется query")

    like_q = f"%{query}%"
    stmt = select(User).where(
        or_(
            User.username.ilike(like_q),
            User.email.ilike(like_q),
        )
    ).limit(50)
    res = await db.execute(stmt)
    users = res.scalars().all()
    return [u.to_dict(viewer_id=current_user.id) for u in users]


@users_router.post("/status")
async def set_user_status(
    payload: Dict[str, Any],
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session),
):
    user_status = payload.get("status")
    if not user_status or user_status not in ["online", "offline"]:
        raise HTTPException(status_code=400, detail="Неверный статус")

    current_user.status = user_status
    current_user.last_seen = datetime.utcnow()
    if user_status == "offline":
        current_user.socket_id = None
    await db.commit()
    return {"success": True, "status": user_status}


@users_router.get("/storage-rules")
async def get_storage_rules(
    current_user: User = Depends(get_current_user),
):
    return {
        "rules": current_user.storage_rules or {"enabled": False, "rules": [], "default_target": "s3"},
        "yandex_disk_available": bool(current_user.yandex_token),
    }


@users_router.put("/storage-rules")
async def update_storage_rules(
    payload: Dict[str, Any],
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session),
):
    rules = payload.get("rules")
    if not isinstance(rules, dict):
        raise HTTPException(status_code=400, detail="rules must be an object")

    if rules.get("enabled") and not current_user.yandex_token:
        raise HTTPException(status_code=400, detail="Yandex Disk не подключён")

    current_user.storage_rules = rules
    await db.commit()
    return {"ok": True, "rules": rules}


@users_router.post("/internal/push-unsubscribe")
async def push_unsubscribe(
    payload: Dict[str, Any],
    db: AsyncSession = Depends(get_async_session),
):
    user_id = payload.get("user_id")
    endpoint = payload.get("endpoint")

    if not user_id or not endpoint:
        raise HTTPException(status_code=400, detail="user_id and endpoint required")

    try:
        await db.execute(
            text("DELETE FROM push_subscriptions WHERE user_id = :uid AND endpoint = :ep"),
            {"uid": user_id, "ep": endpoint}
        )
        await db.commit()
        return {"ok": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@users_router.get("/avatars")
async def get_avatars(
    ids: str = Query(""),
    db: AsyncSession = Depends(get_async_session),
):
    if not ids:
        return {}
    id_list = [i.strip() for i in ids.split(",") if i.strip()]
    if not id_list:
        return {}
    try:
        res = await db.execute(
            select(User.id, User.username, User.avatar_url).where(User.id.in_(id_list))
        )
        rows = res.all()
        return {r[0]: {"username": r[1], "avatar_url": r[2]} for r in rows}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
