from typing import Optional, List, Dict, Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel

from app.core.deps import get_current_user
from app.services.group_service import GroupService
from app.services.message_service import MessageService

groups_router = APIRouter(prefix="/api/v1/groups", tags=["Groups"])


class GroupCreateSchema(BaseModel):
    name: str
    description: Optional[str] = None
    avatar_url: Optional[str] = None


class GroupJoinSchema(BaseModel):
    invite_code: str


class GroupInfoSchema(BaseModel):
    group_id: str


class GroupMemberActionSchema(BaseModel):
    group_id: str
    user_id: str


@groups_router.post("", status_code=status.HTTP_201_CREATED)
@groups_router.post("/", status_code=status.HTTP_201_CREATED)
async def create_group(
    payload: GroupCreateSchema,
    current_user=Depends(get_current_user)
):
    group, error = GroupService.create_group(payload.model_dump(), current_user.id)
    if error or not group:
        raise HTTPException(status_code=400, detail=error or "Failed to create group")
    return {"group": group.to_dict() if hasattr(group, "to_dict") else group}


@groups_router.post("/join")
async def join_group(
    payload: GroupJoinSchema,
    current_user=Depends(get_current_user)
):
    group, error = GroupService.join_group(payload.invite_code, current_user.id)
    if error or not group:
        raise HTTPException(status_code=400, detail=error or "Failed to join group")
    return {"group": group.to_dict() if hasattr(group, "to_dict") else group}


@groups_router.get("/my")
@groups_router.post("/my")
async def get_my_groups(current_user=Depends(get_current_user)):
    groups = GroupService.get_user_groups(current_user.id)
    return {"groups": [g.to_dict() if hasattr(g, "to_dict") else g for g in groups]}


class GroupUpdateSchema(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    avatar_url: Optional[str] = None
    require_approval: Optional[bool] = None


@groups_router.put("/{group_id}")
@groups_router.put("/{group_id}/")
@groups_router.patch("/{group_id}")
@groups_router.patch("/{group_id}/")
@groups_router.post("/{group_id}/update")
async def update_group(
    group_id: str,
    payload: GroupUpdateSchema,
    current_user=Depends(get_current_user)
):
    if not GroupService.is_owner(group_id, current_user.id):
        raise HTTPException(status_code=403, detail="Only owner can update group")
    group, err = GroupService.update_group(group_id, payload.model_dump(exclude_unset=True))
    if err or not group:
        raise HTTPException(status_code=400, detail=err or "Failed to update group")
    return {"group": group.to_dict() if hasattr(group, "to_dict") else group}


@groups_router.post("/info")
@groups_router.get("/{group_id}")
async def get_group(
    group_id: Optional[str] = None,
    payload: Optional[GroupInfoSchema] = None,
    current_user=Depends(get_current_user)
):
    gid = group_id or (payload.group_id if payload else None)
    if not gid:
        raise HTTPException(status_code=400, detail="group_id is required")

    group, error = GroupService.get_group_info(gid, current_user.id)
    if error or not group:
        raise HTTPException(status_code=404, detail=error or "Group not found")
    return {"group": group.to_dict() if hasattr(group, "to_dict") else group}


@groups_router.post("/messages")
@groups_router.get("/{group_id}/messages")
async def get_group_messages(
    group_id: Optional[str] = None,
    limit: int = Query(50, ge=1, le=100),
    payload: Optional[GroupInfoSchema] = None,
    current_user=Depends(get_current_user)
):
    gid = group_id or (payload.group_id if payload else None)
    if not gid:
        raise HTTPException(status_code=400, detail="group_id is required")

    messages = MessageService.get_group_messages(gid, current_user.id, limit=limit)
    return {"messages": [m.to_dict() if hasattr(m, "to_dict") else m for m in messages]}

