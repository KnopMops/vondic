import uuid
import hashlib
import time
from datetime import datetime
from typing import Optional, List, Dict, Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import select

from app.core.database import get_async_db
from app.core.deps import get_current_user, get_optional_current_user
from app.models.notification import Notification
from app.models.playlist import Playlist
from app.models.playlist_borrow import PlaylistBorrow
from app.models.user import User

playlists_router = APIRouter(prefix="/api/v1/playlists", tags=["Playlists"])


class PlaylistCreateSchema(BaseModel):
    name: str
    description: Optional[str] = None
    cover_image: Optional[str] = None
    is_public: Optional[bool] = True
    tracks: Optional[List[Dict[str, Any]]] = None


class PlaylistUpdateSchema(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    cover_image: Optional[str] = None
    is_public: Optional[bool] = None
    is_pinned: Optional[bool] = None
    tracks: Optional[List[Dict[str, Any]]] = None


@playlists_router.post("", status_code=status.HTTP_201_CREATED)
@playlists_router.post("/", status_code=status.HTTP_201_CREATED)
async def create_playlist(
    payload: PlaylistCreateSchema,
    current_user=Depends(get_current_user),
    db=Depends(get_async_db)
):
    playlist = Playlist(
        id=str(uuid.uuid4()),
        name=payload.name,
        description=payload.description,
        cover_image=payload.cover_image,
        owner_id=current_user.id,
        is_public=payload.is_public if payload.is_public is not None else True,
        tracks=payload.tracks or [],
    )
    db.add(playlist)
    await db.commit()
    return {"playlist": playlist.to_dict()}


@playlists_router.get("")
@playlists_router.get("/")
async def list_playlists(
    current_user: Optional[User] = Depends(get_optional_current_user),
    db=Depends(get_async_db)
):
    if current_user:
        res = await db.execute(
            select(Playlist).where(
                (Playlist.owner_id == current_user.id) | (Playlist.is_public == True)
            )
        )
    else:
        res = await db.execute(select(Playlist).where(Playlist.is_public == True))
    playlists = res.scalars().all()
    return {"playlists": [p.to_dict() for p in playlists]}


@playlists_router.get("/my")
async def my_playlists(
    current_user=Depends(get_current_user),
    db=Depends(get_async_db)
):
    res = await db.execute(select(Playlist).where(Playlist.owner_id == current_user.id))
    playlists = res.scalars().all()
    return {"playlists": [p.to_dict() for p in playlists]}


@playlists_router.get("/{playlist_id}")
async def get_playlist(
    playlist_id: str,
    current_user: Optional[User] = Depends(get_optional_current_user),
    db=Depends(get_async_db)
):
    res = await db.execute(select(Playlist).where(Playlist.id == playlist_id))
    playlist = res.scalar_one_or_none()
    if not playlist:
        raise HTTPException(status_code=404, detail="Playlist not found")

    if not playlist.is_public and (not current_user or current_user.id != playlist.owner_id):
        raise HTTPException(status_code=403, detail="Private playlist")

    return {"playlist": playlist.to_dict()}


@playlists_router.put("/{playlist_id}")
async def update_playlist(
    playlist_id: str,
    payload: PlaylistUpdateSchema,
    current_user=Depends(get_current_user),
    db=Depends(get_async_db)
):
    res = await db.execute(select(Playlist).where(Playlist.id == playlist_id))
    playlist = res.scalar_one_or_none()
    if not playlist:
        raise HTTPException(status_code=404, detail="Playlist not found")

    if playlist.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Forbidden")

    data = payload.model_dump(exclude_unset=True)
    for field, val in data.items():
        if hasattr(playlist, field):
            setattr(playlist, field, val)

    playlist.updated_at = datetime.utcnow()
    await db.commit()
    return {"playlist": playlist.to_dict()}


@playlists_router.delete("/{playlist_id}")
async def delete_playlist(
    playlist_id: str,
    current_user=Depends(get_current_user),
    db=Depends(get_async_db)
):
    res = await db.execute(select(Playlist).where(Playlist.id == playlist_id))
    playlist = res.scalar_one_or_none()
    if not playlist:
        raise HTTPException(status_code=404, detail="Playlist not found")

    if playlist.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Forbidden")

    await db.delete(playlist)
    await db.commit()
    return {"message": "Playlist deleted"}
