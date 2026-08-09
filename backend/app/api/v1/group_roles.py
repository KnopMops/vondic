from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select

from app.core.database import get_async_db
from app.core.deps import get_current_user
from app.models.group_role import GroupRole

group_roles_router = APIRouter(prefix="/api/v1/group-roles", tags=["Group Roles"])


class GroupRoleSetSchema(BaseModel):
    group_id: str
    user_id: str
    role: Optional[str] = "member"


class GroupRoleDeleteSchema(BaseModel):
    group_id: str
    user_id: str


@group_roles_router.get("")
@group_roles_router.get("/")
async def list_roles(
    group_id: str = Query(...),
    current_user=Depends(get_current_user),
    db=Depends(get_async_db)
):
    res = await db.execute(select(GroupRole).where(GroupRole.group_id == group_id))
    roles = res.scalars().all()
    return [{"id": r.id, "user_id": r.user_id, "role": r.role} for r in roles]


@group_roles_router.post("")
@group_roles_router.post("/")
async def set_role(
    payload: GroupRoleSetSchema,
    current_user=Depends(get_current_user),
    db=Depends(get_async_db)
):
    if payload.role not in ("admin", "moderator", "member"):
        raise HTTPException(status_code=400, detail="role must be admin/moderator/member")

    res = await db.execute(
        select(GroupRole).where(
            GroupRole.group_id == payload.group_id,
            GroupRole.user_id == payload.user_id
        )
    )
    existing = res.scalar_one_or_none()
    if existing:
        existing.role = payload.role
    else:
        existing = GroupRole(group_id=payload.group_id, user_id=payload.user_id, role=payload.role)
        db.add(existing)

    await db.commit()
    return {"ok": True, "role": payload.role}


@group_roles_router.delete("")
@group_roles_router.delete("/")
async def remove_role(
    payload: GroupRoleDeleteSchema,
    current_user=Depends(get_current_user),
    db=Depends(get_async_db)
):
    res = await db.execute(
        select(GroupRole).where(
            GroupRole.group_id == payload.group_id,
            GroupRole.user_id == payload.user_id
        )
    )
    role_obj = res.scalar_one_or_none()
    if role_obj:
        await db.delete(role_obj)
        await db.commit()
    return {"ok": True}


@group_roles_router.get("/check")
async def check_role(
    group_id: str = Query(...),
    user_id: Optional[str] = Query(None),
    current_user=Depends(get_current_user),
    db=Depends(get_async_db)
):
    target_uid = user_id or str(current_user.id)
    res = await db.execute(
        select(GroupRole).where(
            GroupRole.group_id == group_id,
            GroupRole.user_id == target_uid
        )
    )
    role_obj = res.scalar_one_or_none()
    return {"role": role_obj.role if role_obj else "member"}
