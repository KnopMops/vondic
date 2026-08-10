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


@channels_router.post("", status_code=status.HTTP_201_CREATED)
@channels_router.post("/", status_code=status.HTTP_201_CREATED)
async def create_channel(
    payload: ChannelCreateSchema,
    current_user=Depends(get_current_user)
):
    try:
        channel = ChannelService.create_channel(
            owner_id=current_user.id,
            name=payload.name,
            description=payload.description,
            avatar_url=payload.avatar_url,
            channel_type=payload.type or "text"
        )
        return {"channel": channel.to_dict() if hasattr(channel, "to_dict") else channel}
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
        return {"channels": [c.to_dict() if hasattr(c, "to_dict") else c for c in channels]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



@channels_router.get("/{channel_id}")
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


@channels_router.put("/{channel_id}")
async def update_channel(
    channel_id: str,
    payload: ChannelUpdateSchema,
    current_user=Depends(get_current_user)
):
    try:
        data = payload.model_dump(exclude_unset=True)
        channel = ChannelService.update_channel(channel_id, current_user.id, data)
        return {"channel": channel.to_dict() if hasattr(channel, "to_dict") else channel}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@channels_router.delete("/{channel_id}")
async def delete_channel(channel_id: str, current_user=Depends(get_current_user)):
    try:
        ChannelService.delete_channel(channel_id, current_user.id)
        return {"message": "Channel deleted"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@channels_router.post("/{channel_id}/join")
async def join_channel(channel_id: str, current_user=Depends(get_current_user)):
    try:
        ChannelService.add_subscriber(channel_id, current_user.id)
        return {"message": "Joined channel"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@channels_router.post("/{channel_id}/leave")
async def leave_channel(channel_id: str, current_user=Depends(get_current_user)):
    try:
        ChannelService.remove_subscriber(channel_id, current_user.id)
        return {"message": "Left channel"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
