import os
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import or_, select
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


    try:
        from sqlalchemy import text
        db.session.execute(text(
            "CREATE TABLE IF NOT EXISTS push_subscriptions ("
            "id SERIAL PRIMARY KEY, user_id TEXT NOT NULL, endpoint TEXT NOT NULL, "
            "p256dh TEXT NOT NULL, auth TEXT NOT NULL, platform TEXT DEFAULT 'web', "
            "created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, "
            "CONSTRAINT uq_push_sub_user_ep UNIQUE (user_id, endpoint))"
        ))
        db.session.execute(text(
            "INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, platform) "
            "VALUES (:uid, :ep, :p256, :auth, :plat) "
            "ON CONFLICT (user_id, endpoint) DO UPDATE SET p256dh = :p256, auth = :auth, platform = :plat"
        ), {"uid": user_id, "ep": endpoint, "p256": p256dh, "auth": auth, "plat": platform})
        db.session.commit()
        return jsonify({"ok": True})
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


@users_bp.route("/internal/push-unsubscribe", methods=["POST"])
def push_unsubscribe():
    """Remove PWA push subscription."""
    data = request.get_json() or {}
    user_id = data.get("user_id")
    endpoint = data.get("endpoint")

    if not user_id or not endpoint:
        return jsonify({"error": "user_id and endpoint required"}), 400

    try:
        from sqlalchemy import text
        db.session.execute(text(
            "DELETE FROM push_subscriptions WHERE user_id = :uid AND endpoint = :ep"
        ), {"uid": user_id, "ep": endpoint})
        db.session.commit()
        return jsonify({"ok": True})
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500



@users_bp.route("/avatars", methods=["GET"])
def get_avatars():
    """Get avatar URLs for a list of user IDs."""
    ids_str = request.args.get("ids", "")
    if not ids_str:
        return jsonify({})
    ids = [i.strip() for i in ids_str.split(",") if i.strip()]
    if not ids:
        return jsonify({})
    try:
        from sqlalchemy import text
        rows = db.session.execute(
            text("SELECT id, username, avatar_url FROM users WHERE id IN :ids"),
            {"ids": tuple(ids)}
        ).fetchall()
        return jsonify({
            row[0]: {"username": row[1], "avatar_url": row[2]}
            for row in rows
        })
    except Exception:
        return jsonify({})
