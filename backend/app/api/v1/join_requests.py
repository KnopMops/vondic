from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select

from app.core.database import get_async_db
from app.core.deps import get_current_user, get_optional_current_user
from app.models.join_request import JoinRequest
from app.models.user import User
from app.models.group import Group
from app.models.channel import Channel
from app.models.community import Community

join_requests_router = APIRouter(prefix="/api/v1/join-requests", tags=["Join Requests"])


class JoinRequestCreateSchema(BaseModel):
    target_type: str  # group, channel, community
    target_id: str


class JoinRequestActionSchema(BaseModel):
    request_id: str


@join_requests_router.post("/create", status_code=status.HTTP_201_CREATED)
async def create_join_request(
    payload: JoinRequestCreateSchema,
    current_user=Depends(get_current_user),
    db=Depends(get_async_db)
):
    target_name = "Чат"
    owner_id = None

    if payload.target_type == "group":
        res = await db.execute(select(Group).where(Group.id == payload.target_id))
        g = res.scalar_one_or_none()
        if g:
            target_name = g.name
            owner_id = g.owner_id
    elif payload.target_type == "channel":
        res = await db.execute(select(Channel).where(Channel.id == payload.target_id))
        ch = res.scalar_one_or_none()
        if ch:
            target_name = ch.name
            owner_id = ch.owner_id
    elif payload.target_type == "community":
        res = await db.execute(select(Community).where(Community.id == payload.target_id))
        c = res.scalar_one_or_none()
        if c:
            target_name = c.name
            owner_id = c.owner_id

    req = JoinRequest(
        target_type=payload.target_type,
        target_id=payload.target_id,
        user_id=current_user.id,
        status="pending",
    )
    db.add(req)
    await db.commit()
    await db.refresh(req)

    return {
        "message": "Заявка отправлена администраторам",
        "request": req.to_dict(),
        "details": {
            "applicant": {
                "id": current_user.id,
                "username": current_user.username,
                "profile_url": f"/feed/profile/{current_user.id}",
            },
            "target_name": target_name,
            "owner_id": owner_id,
        }
    }


@join_requests_router.post("/approve")
async def approve_join_request(
    payload: JoinRequestActionSchema,
    current_user=Depends(get_current_user),
    db=Depends(get_async_db)
):
    res = await db.execute(select(JoinRequest).where(JoinRequest.id == payload.request_id))
    req = res.scalar_one_or_none()
    if not req:
        raise HTTPException(status_code=404, detail="Заявка не найдена")

    req.status = "approved"
    
    # Add user to target group / channel / community
    if req.target_type == "group":
        from app.services.group_service import GroupService
        GroupService.add_participant(req.target_id, target_user_id=req.user_id, requester_id=current_user.id)
    elif req.target_type == "channel":
        from app.services.channel_service import ChannelService
        ChannelService.add_subscriber(req.target_id, req.user_id)
    elif req.target_type == "community":
        from app.services.community_service import CommunityService
        CommunityService.join_community(req.target_id, req.user_id)

    await db.commit()
    return {"message": "Заявка одобрена, пользователь добавлен", "request": req.to_dict()}


@join_requests_router.post("/decline")
async def decline_join_request(
    payload: JoinRequestActionSchema,
    current_user=Depends(get_current_user),
    db=Depends(get_async_db)
):
    res = await db.execute(select(JoinRequest).where(JoinRequest.id == payload.request_id))
    req = res.scalar_one_or_none()
    if not req:
        raise HTTPException(status_code=404, detail="Заявка не найдена")

    req.status = "declined"
    await db.commit()
    return {"message": "Заявка отклонена", "request": req.to_dict()}
