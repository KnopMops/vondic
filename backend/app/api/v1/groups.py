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


@groups_router.post("/leave")
async def leave_group(
    payload: GroupInfoSchema,
    current_user=Depends(get_current_user)
):
    success, error = GroupService.leave_group(payload.group_id, current_user.id)
    if error:
        raise HTTPException(status_code=400, detail=error)
    return {"message": "Left group"}


@groups_router.post("/add-member")
async def add_member(
    payload: GroupMemberActionSchema,
    current_user=Depends(get_current_user)
):
    success, error = GroupService.add_member(payload.group_id, current_user.id, payload.user_id)
    if error:
        raise HTTPException(status_code=400, detail=error)
    return {"message": "Member added"}


@groups_router.post("/remove-member")
async def remove_member(
    payload: GroupMemberActionSchema,
    current_user=Depends(get_current_user)
):
    success, error = GroupService.remove_member(payload.group_id, current_user.id, payload.user_id)
    if error:
        raise HTTPException(status_code=400, detail=error)
    return {"message": "Member removed"}


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
