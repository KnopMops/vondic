from typing import Optional, List, Dict, Any

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from app.core.deps import get_current_user
from app.services.message_service import MessageService

dm_router = APIRouter(prefix="/api/v1/dm", tags=["Direct Messages"])


class DMSettingsUpdateSchema(BaseModel):
    is_secret: Optional[bool] = None


@dm_router.get("/recent")
async def get_recent_contacts(
    limit: int = Query(30, ge=1, le=100),
    current_user=Depends(get_current_user)
):
    contacts = MessageService.get_recent_contacts(current_user.id, limit=limit)
    return {"items": contacts}


@dm_router.get("/{target_id}/settings")
async def get_dm_settings(
    target_id: str,
    current_user=Depends(get_current_user)
):
    settings = MessageService.get_dm_settings(current_user.id, target_id)
    return settings


@dm_router.put("/{target_id}/settings")
async def update_dm_settings(
    target_id: str,
    payload: DMSettingsUpdateSchema,
    current_user=Depends(get_current_user)
):
    settings = MessageService.update_dm_settings(
        current_user.id, target_id, is_secret=payload.is_secret
    )
    return settings


@dm_router.get("/{target_id}")
async def get_direct_messages(
    target_id: str,
    limit: int = Query(50, ge=1, le=100),
    current_user=Depends(get_current_user)
):
    messages = MessageService.get_direct_messages(current_user.id, target_id, limit=limit)
    return {"messages": [m.to_dict() if hasattr(m, "to_dict") else m for m in messages]}
