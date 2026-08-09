import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional, List, Dict, Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select

from app.core.database import get_async_db
from app.core.deps import get_current_user
from app.models.user import User
from app.services.friendship_service import FriendshipService

storis_router = APIRouter(prefix="/api/v1/storis", tags=["Stories"])


class StoryCreateSchema(BaseModel):
    media_url: str
    caption: Optional[str] = None
    visibility: Optional[str] = "public"


@storis_router.get("")
@storis_router.get("/")
async def list_stories(
    current_user=Depends(get_current_user),
    db=Depends(get_async_db)
):
    res = await db.execute(select(User))
    users = res.scalars().all()
    now = datetime.now(timezone.utc)
    result = []

    for u in users:
        storis = u.storis or []
        active_storis = []
        for s in storis:
            if isinstance(s, dict):
                active_storis.append(s)
        if active_storis:
            result.append({
                "user_id": u.id,
                "username": u.username,
                "avatar_url": u.avatar_url,
                "storis": active_storis
            })

    return {"stories": result}


@storis_router.post("", status_code=status.HTTP_201_CREATED)
@storis_router.post("/", status_code=status.HTTP_201_CREATED)
async def create_story(
    payload: StoryCreateSchema,
    current_user=Depends(get_current_user),
    db=Depends(get_async_db)
):
    res = await db.execute(select(User).where(User.id == current_user.id))
    user = res.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    storis = list(user.storis or [])
    new_story = {
        "id": str(uuid.uuid4()),
        "media_url": payload.media_url,
        "caption": payload.caption,
        "visibility": payload.visibility or "public",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "reactions": []
    }
    storis.append(new_story)
    user.storis = storis
    await db.commit()

    return {"story": new_story, "message": "Story published"}
