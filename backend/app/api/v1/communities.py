from typing import Optional, List, Dict, Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.core.deps import get_current_user
from app.services.community_channel_service import CommunityChannelService
from app.services.community_service import CommunityService

communities_router = APIRouter(prefix="/api/v1/communities", tags=["Communities"])


class CommunityCreateSchema(BaseModel):
    name: str
    description: Optional[str] = None
    avatar_url: Optional[str] = None


class CommunityJoinSchema(BaseModel):
    invite_code: Optional[str] = None
    code: Optional[str] = None
    id: Optional[str] = None


class ChannelCreateSchema(BaseModel):
    name: str
    description: Optional[str] = None
    type: Optional[str] = "text"


@communities_router.post("", status_code=status.HTTP_200_OK)
@communities_router.post("/", status_code=status.HTTP_200_OK)
async def create_community(
    payload: CommunityCreateSchema,
    current_user=Depends(get_current_user)
):
    community, err = CommunityService.create_community(payload.model_dump(), current_user.id)
    if err or not community:
        raise HTTPException(status_code=400, detail=err or "Failed to create community")
    return {"community": community.to_dict() if hasattr(community, "to_dict") else community}


@communities_router.post("/my")
@communities_router.get("/my")
async def my_communities(current_user=Depends(get_current_user)):
    items = CommunityService.get_user_communities(current_user.id)
    return {"communities": [c.to_dict() if hasattr(c, "to_dict") else c for c in items]}


@communities_router.post("/join")
async def join_community(
    payload: CommunityJoinSchema,
    current_user=Depends(get_current_user)
):
    code = payload.invite_code or payload.code or payload.id
    if not code:
        raise HTTPException(status_code=400, detail="invite_code is required")
    community, err = CommunityService.join_community(code, current_user.id)
    if err or not community:
        raise HTTPException(status_code=400, detail=err or "Failed to join community")
    return {"community": community.to_dict() if hasattr(community, "to_dict") else community}


@communities_router.post("/{community_id}")
@communities_router.get("/{community_id}")
async def community_info(
    community_id: str,
    current_user=Depends(get_current_user)
):
    community = CommunityService.get_by_id(community_id)
    if not community:
        raise HTTPException(status_code=404, detail="Community not found")
    return {"community": community.to_dict() if hasattr(community, "to_dict") else community}


@communities_router.get("/{community_id}/invite")
@communities_router.post("/{community_id}/invite")
async def get_community_invite(
    community_id: str,
    current_user=Depends(get_current_user)
):
    invite_code, err = CommunityService.get_invite_code(community_id)
    if err or not invite_code:
        raise HTTPException(status_code=404, detail=err or "Community not found")
    return {"invite_code": invite_code}


@communities_router.post("/{community_id}/channels/list")
@communities_router.get("/{community_id}/channels/list")
@communities_router.get("/{community_id}/channels")
async def list_community_channels(
    community_id: str,
    current_user=Depends(get_current_user)
):
    channels = CommunityChannelService.get_channels_by_community(community_id)
    return {"channels": [ch.to_dict() if hasattr(ch, "to_dict") else ch for ch in channels]}


class CommunityUpdateSchema(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    avatar_url: Optional[str] = None


@communities_router.put("/{community_id}")
@communities_router.post("/{community_id}/update")
async def update_community(
    community_id: str,
    payload: CommunityUpdateSchema,
    current_user=Depends(get_current_user)
):
    community = CommunityService.get_by_id(community_id)
    if not community:
        raise HTTPException(status_code=404, detail="Community not found")
    if str(community.owner_id) != str(current_user.id):
        raise HTTPException(status_code=403, detail="Only server owner can edit server")
    updated, err = CommunityService.update_community(community_id, payload.model_dump(exclude_unset=True))
    if err or not updated:
        raise HTTPException(status_code=400, detail=err or "Failed to update community")
    return {"community": updated.to_dict() if hasattr(updated, "to_dict") else updated}


@communities_router.post("/{community_id}/channels")
@communities_router.post("/{community_id}/channels/create")
async def create_community_channel(
    community_id: str,
    payload: ChannelCreateSchema,
    current_user=Depends(get_current_user)
):
    channel, err = CommunityChannelService.create_channel(
        community_id=community_id,
        name=payload.name,
        description=payload.description,
        channel_type=payload.type or "text",
        user_id=current_user.id,
    )
    if err or not channel:
        raise HTTPException(status_code=400, detail=err or "Failed to create channel")
    return {"channel": channel.to_dict() if hasattr(channel, "to_dict") else channel}


