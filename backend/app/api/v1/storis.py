import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional, List, Dict, Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import select

from app.core.database import get_async_db
from app.core.deps import get_current_user, get_optional_current_user
from app.models.user import User
from app.services.friendship_service import FriendshipService

storis_router = APIRouter(prefix="/api/v1/storis", tags=["Stories"])


class StoryCreateSchema(BaseModel):
    media_url: Optional[str] = None
    url: Optional[str] = None
    caption: Optional[str] = None
    visibility: Optional[str] = "public"


@storis_router.get("")
@storis_router.get("/")
async def list_stories(
    current_user: Optional[User] = Depends(get_optional_current_user),
    db=Depends(get_async_db)
):
    res = await db.execute(select(User))
    users = res.scalars().all()
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


@storis_router.get("/friends")
@storis_router.post("/friends")
@storis_router.get("/feed")
@storis_router.post("/feed")
async def friends_stories(
    current_user: Optional[User] = Depends(get_optional_current_user),
    db=Depends(get_async_db)
):
    return await list_stories(current_user=current_user, db=db)


@storis_router.get("/user")
@storis_router.post("/user")
@storis_router.get("/user/{user_id}")
@storis_router.post("/user/{user_id}")
async def user_stories(
    user_id: Optional[str] = None,
    payload: Optional[Dict[str, Any]] = None,
    current_user: Optional[User] = Depends(get_optional_current_user),
    db=Depends(get_async_db)
):
    target_id = user_id
    if not target_id and payload:
        target_id = payload.get("user_id") or payload.get("id")
    if not target_id and current_user:
        target_id = current_user.id

    if not target_id:
        return {"stories": []}

    res = await db.execute(select(User).where(User.id == target_id))
    u = res.scalar_one_or_none()
    if not u:
        return {"stories": []}

    storis = u.storis or []
    active_storis = []
    for s in storis:
        if isinstance(s, dict):
            active_storis.append(s)

    return {
        "user_id": u.id,
        "username": u.username,
        "avatar_url": u.avatar_url,
        "storis": active_storis,
        "stories": active_storis
    }


@storis_router.post("", status_code=status.HTTP_201_CREATED)
@storis_router.post("/", status_code=status.HTTP_201_CREATED)
@storis_router.post("/create", status_code=status.HTTP_201_CREATED)
async def create_story(
    payload: StoryCreateSchema,
    current_user: User = Depends(get_current_user),
    db=Depends(get_async_db)
):
    res = await db.execute(select(User).where(User.id == current_user.id))
    user = res.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    storis = list(user.storis or [])
    media_url = payload.media_url or payload.url or ""
    new_story = {
        "id": str(uuid.uuid4()),
        "url": media_url,
        "media_url": media_url,
        "caption": payload.caption or "",
        "text": payload.caption or "",
        "visibility": payload.visibility or "public",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "reactions": []
    }
    storis.append(new_story)
    user.storis = storis
    await db.commit()

    return {"story": new_story, "message": "Story published"}


@storis_router.post("/react")
@storis_router.post("/reaction")
async def add_story_reaction(
    payload: Dict[str, Any],
    current_user: User = Depends(get_current_user),
    db=Depends(get_async_db)
):
    story_id = payload.get("story_id") or payload.get("id")
    owner_id = payload.get("owner_id") or current_user.id
    reaction = payload.get("emoji") or payload.get("reaction") or "❤️"
    if not story_id:
        raise HTTPException(status_code=400, detail="story_id is required")

    res = await db.execute(select(User).where(User.id == owner_id))
    owner = res.scalar_one_or_none()
    if not owner:
        return {"ok": True, "message": "Reaction recorded"}

    storis = list(owner.storis or [])
    matched_story = None
    for s in storis:
        if isinstance(s, dict) and s.get("id") == story_id:
            reactions = list(s.get("reactions") or [])
            # toggle or append
            user_existing = [r for r in reactions if isinstance(r, dict) and r.get("user_id") == current_user.id]
            if user_existing:
                reactions = [r for r in reactions if not (isinstance(r, dict) and r.get("user_id") == current_user.id)]
                if user_existing[0].get("emoji") != reaction:
                    reactions.append({"user_id": current_user.id, "emoji": reaction, "username": current_user.username})
            else:
                reactions.append({"user_id": current_user.id, "emoji": reaction, "username": current_user.username})
            s["reactions"] = reactions
            matched_story = s
            break

    owner.storis = storis
    await db.commit()

    return {"ok": True, "message": "Reaction updated", "story": matched_story or {"id": story_id, "reactions": []}}


@storis_router.delete("/{story_id}")
@storis_router.post("/delete")
@storis_router.delete("")
@storis_router.delete("/")
async def delete_story(
    story_id: Optional[str] = None,
    payload: Optional[Dict[str, Any]] = None,
    current_user: User = Depends(get_current_user),
    db=Depends(get_async_db)
):
    target_id = story_id or (payload.get("story_id") if payload else None) or (payload.get("id") if payload else None)
    if not target_id:
        raise HTTPException(status_code=400, detail="story_id is required")

    res = await db.execute(select(User).where(User.id == current_user.id))
    user = res.scalar_one_or_none() or current_user

    storis = list(user.storis or [])
    updated = [s for s in storis if isinstance(s, dict) and s.get("id") != target_id]
    user.storis = updated
    await db.commit()
    return {"ok": True, "message": "Story deleted", "storis": updated}

