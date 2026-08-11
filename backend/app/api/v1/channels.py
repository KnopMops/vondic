from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.core.deps import get_current_user
from app.services.channel_service import ChannelService

channels_router = APIRouter(prefix="/api/v1/channels", tags=["Channels"])


class ChannelCreateSchema(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=500)
    avatar_url: Optional[str] = None
    type: Optional[str] = "text"


class ChannelUpdateSchema(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=500)
    avatar_url: Optional[str] = None
    type: Optional[str] = None
    require_approval: Optional[bool] = None


class ChannelJoinSchema(BaseModel):
    invite_code: str


@channels_router.post("", status_code=status.HTTP_201_CREATED)
@channels_router.post("/", status_code=status.HTTP_201_CREATED)
async def create_channel(
    payload: ChannelCreateSchema,
    current_user=Depends(get_current_user)
):
    try:
        channel, err = ChannelService.create_channel(
            {
                "name": payload.name,
                "description": payload.description,
                "avatar_url": payload.avatar_url,
                "type": payload.type or "text",
            },
            current_user.id
        )
        if err or not channel:
            raise HTTPException(status_code=400, detail=err or "Failed to create channel")
        return {"channel": channel.to_dict() if hasattr(channel, "to_dict") else channel}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@channels_router.get("")
@channels_router.get("/")
@channels_router.post("")
@channels_router.post("/")
@channels_router.get("/my")
@channels_router.post("/my")
async def list_channels(current_user=Depends(get_current_user)):
    try:
        channels = ChannelService.get_user_channels(current_user.id)
        return {"channels": [c if isinstance(c, dict) else (c.to_dict() if hasattr(c, "to_dict") else c) for c in channels]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@channels_router.post("/join")
async def join_channel_by_code(
    payload: ChannelJoinSchema,
    current_user=Depends(get_current_user)
):
    try:
        channel, err = ChannelService.join_channel(payload.invite_code, current_user.id)
        if err or not channel:
            raise HTTPException(status_code=400, detail=err or "Failed to join channel")
        return channel.to_dict() if hasattr(channel, "to_dict") else channel
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@channels_router.put("/{channel_id}")
@channels_router.put("/{channel_id}/")
@channels_router.patch("/{channel_id}")
@channels_router.patch("/{channel_id}/")
@channels_router.post("/{channel_id}/update")
async def update_channel(
    channel_id: str,
    payload: ChannelUpdateSchema,
    current_user=Depends(get_current_user)
):
    try:
        data = payload.model_dump(exclude_unset=True)
        channel, err = ChannelService.update_channel(channel_id, data)
        if err or not channel:
            raise HTTPException(status_code=400, detail=err or "Failed to update channel")
        return {"channel": channel.to_dict() if hasattr(channel, "to_dict") else channel}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@channels_router.get("/{channel_id}")
@channels_router.post("/{channel_id}")
async def get_channel(channel_id: str, current_user=Depends(get_current_user)):
    try:
        channel = ChannelService.get_channel_by_id(channel_id)
        if not channel:
            raise HTTPException(status_code=404, detail="Channel not found")
        return {"channel": channel.to_dict() if hasattr(channel, "to_dict") else channel}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@channels_router.get("/{channel_id}/invite")
@channels_router.post("/{channel_id}/invite")
async def get_channel_invite(channel_id: str, current_user=Depends(get_current_user)):
    try:
        invite_code, err = ChannelService.get_invite_code(channel_id)
        if err or not invite_code:
            raise HTTPException(status_code=404, detail=err or "Channel not found")
        return {"invite_code": invite_code}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@channels_router.get("/{channel_id}/participants")
@channels_router.post("/{channel_id}/participants")
async def get_channel_participants(channel_id: str, current_user=Depends(get_current_user)):
    try:
        channel = ChannelService.get_channel_by_id(channel_id)
        if not channel:
            raise HTTPException(status_code=404, detail="Channel not found")
        participants = getattr(channel, "participants", [])
        return [p.to_dict() if hasattr(p, "to_dict") else p for p in participants]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@channels_router.delete("/{channel_id}")
async def delete_channel(channel_id: str, current_user=Depends(get_current_user)):
    try:
        _, err = ChannelService.delete_channel(channel_id, current_user.id)
        if err:
            raise HTTPException(status_code=400, detail=err)
        return {"message": "Channel deleted"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@channels_router.post("/{channel_id}/join")
async def join_channel_by_id(channel_id: str, current_user=Depends(get_current_user)):
    try:
        channel, err = ChannelService.join_channel(channel_id, current_user.id)
        if err or not channel:
            raise HTTPException(status_code=400, detail=err or "Failed to join channel")
        return {"message": "Joined channel"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@channels_router.post("/{channel_id}/leave")
async def leave_channel(channel_id: str, current_user=Depends(get_current_user)):
    try:
        channel, err = ChannelService.leave_channel(channel_id, current_user.id)
        if err:
            raise HTTPException(status_code=400, detail=err)
        return {"message": "Left channel"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
