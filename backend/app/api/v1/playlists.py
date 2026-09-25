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
@playlists_router.post("/create", status_code=status.HTTP_201_CREATED)
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


@playlists_router.get("/user/{user_id}/public")
async def user_public_playlists(
    user_id: str,
    db=Depends(get_async_db)
):
    res = await db.execute(
        select(Playlist).where(
            Playlist.owner_id == user_id,
            Playlist.is_public == True
        )
    )
    playlists = res.scalars().all()
    return {"playlists": [p.to_dict() for p in playlists]}


@playlists_router.post("/{playlist_id}/add-tracks")
async def add_tracks_to_playlist(
    playlist_id: str,
    payload: Dict[str, Any],
    current_user=Depends(get_current_user),
    db=Depends(get_async_db)
):
    res = await db.execute(select(Playlist).where(Playlist.id == playlist_id))
    playlist = res.scalar_one_or_none()
    if not playlist:
        raise HTTPException(status_code=404, detail="Playlist not found")
    if playlist.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Forbidden")

    tracks_to_add = payload.get("tracks")
    if not tracks_to_add:
        single_track = payload.get("track")
        if single_track:
            tracks_to_add = [single_track]
        elif "track_id" in payload:
            tracks_to_add = [{"id": payload["track_id"]}]
        else:
            tracks_to_add = []

    current_tracks = list(playlist.tracks or [])
    existing_ids = {str(t.get("id")) for t in current_tracks if isinstance(t, dict) and t.get("id")}

    for t in tracks_to_add:
        if isinstance(t, dict):
            tid = str(t.get("id") or "")
            if not tid or tid not in existing_ids:
                current_tracks.append(t)
                if tid:
                    existing_ids.add(tid)
        elif isinstance(t, str):
            if t not in existing_ids:
                current_tracks.append({"id": t})
                existing_ids.add(t)

    playlist.tracks = current_tracks
    playlist.updated_at = datetime.utcnow()
    await db.commit()
    return {"playlist": playlist.to_dict()}


@playlists_router.post("/{playlist_id}/remove-tracks")
async def remove_tracks_from_playlist(
    playlist_id: str,
    payload: Dict[str, Any],
    current_user=Depends(get_current_user),
    db=Depends(get_async_db)
):
    res = await db.execute(select(Playlist).where(Playlist.id == playlist_id))
    playlist = res.scalar_one_or_none()
    if not playlist:
        raise HTTPException(status_code=404, detail="Playlist not found")
    if playlist.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Forbidden")

    remove_ids = set()
    if "track_ids" in payload:
        remove_ids = {str(x) for x in payload["track_ids"]}
    elif "track_id" in payload:
        remove_ids = {str(payload["track_id"])}
    elif "tracks" in payload:
        for t in payload["tracks"]:
            if isinstance(t, dict) and t.get("id"):
                remove_ids.add(str(t["id"]))
            elif isinstance(t, str):
                remove_ids.add(str(t))

    current_tracks = list(playlist.tracks or [])
    updated = [t for t in current_tracks if not (isinstance(t, dict) and str(t.get("id")) in remove_ids) and str(t) not in remove_ids]
    playlist.tracks = updated
    playlist.updated_at = datetime.utcnow()
    await db.commit()
    return {"playlist": playlist.to_dict()}


@playlists_router.post("/borrow")
async def borrow_playlist(
    payload: Dict[str, Any],
    current_user=Depends(get_current_user),
    db=Depends(get_async_db)
):
    source_playlist_id = payload.get("source_playlist_id") or payload.get("playlist_id")
    if not source_playlist_id:
        raise HTTPException(status_code=400, detail="source_playlist_id is required")

    res = await db.execute(select(Playlist).where(Playlist.id == source_playlist_id))
    source = res.scalar_one_or_none()
    if not source:
        raise HTTPException(status_code=404, detail="Source playlist not found")

    local_id = str(uuid.uuid4())
    local_name = payload.get("name") or f"{source.name} (копия)"
    local = Playlist(
        id=local_id,
        name=local_name,
        description=source.description,
        cover_image=source.cover_image,
        owner_id=current_user.id,
        is_public=False,
        tracks=list(source.tracks or []),
    )
    db.add(local)

    borrow = PlaylistBorrow(
        id=str(uuid.uuid4()),
        borrower_id=current_user.id,
        local_playlist_id=local_id,
        source_playlist_id=source.id,
        source_owner_id=source.owner_id,
        status="approved",
        auto_sync=bool(payload.get("auto_sync", False)),
        last_synced_at=datetime.utcnow(),
    )
    db.add(borrow)
    await db.commit()

    return {
        "ok": True,
        "borrow_id": borrow.id,
        "playlist": local.to_dict(),
        "message": "Playlist borrowed successfully"
    }


@playlists_router.get("/borrow/requests")
async def get_borrow_requests(
    current_user=Depends(get_current_user),
    db=Depends(get_async_db)
):
    res = await db.execute(
        select(PlaylistBorrow).where(
            (PlaylistBorrow.source_owner_id == current_user.id) |
            (PlaylistBorrow.borrower_id == current_user.id)
        )
    )
    borrows = res.scalars().all()
    return {
        "requests": [
            {
                "id": b.id,
                "borrower_id": b.borrower_id,
                "local_playlist_id": b.local_playlist_id,
                "source_playlist_id": b.source_playlist_id,
                "source_owner_id": b.source_owner_id,
                "status": b.status,
                "auto_sync": b.auto_sync,
                "created_at": b.created_at.isoformat() if b.created_at else None,
            }
            for b in borrows
        ]
    }


@playlists_router.post("/borrow/requests/{borrow_id}/approve")
async def approve_borrow_request(
    borrow_id: str,
    current_user=Depends(get_current_user),
    db=Depends(get_async_db)
):
    res = await db.execute(select(PlaylistBorrow).where(PlaylistBorrow.id == borrow_id))
    borrow = res.scalar_one_or_none()
    if not borrow:
        raise HTTPException(status_code=404, detail="Request not found")
    if borrow.source_owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Forbidden")
    borrow.status = "approved"
    await db.commit()
    return {"ok": True, "status": "approved"}


@playlists_router.post("/borrow/requests/{borrow_id}/reject")
async def reject_borrow_request(
    borrow_id: str,
    current_user=Depends(get_current_user),
    db=Depends(get_async_db)
):
    res = await db.execute(select(PlaylistBorrow).where(PlaylistBorrow.id == borrow_id))
    borrow = res.scalar_one_or_none()
    if not borrow:
        raise HTTPException(status_code=404, detail="Request not found")
    if borrow.source_owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Forbidden")
    borrow.status = "rejected"
    await db.commit()
    return {"ok": True, "status": "rejected"}


@playlists_router.post("/borrow/{local_playlist_id}/sync")
async def sync_borrowed_playlist(
    local_playlist_id: str,
    current_user=Depends(get_current_user),
    db=Depends(get_async_db)
):
    res = await db.execute(
        select(PlaylistBorrow).where(
            PlaylistBorrow.local_playlist_id == local_playlist_id,
            PlaylistBorrow.borrower_id == current_user.id
        )
    )
    borrow = res.scalar_one_or_none()
    if not borrow:
        raise HTTPException(status_code=404, detail="Borrow link not found")

    res_s = await db.execute(select(Playlist).where(Playlist.id == borrow.source_playlist_id))
    source = res_s.scalar_one_or_none()
    res_l = await db.execute(select(Playlist).where(Playlist.id == local_playlist_id))
    local = res_l.scalar_one_or_none()

    if not source or not local:
        raise HTTPException(status_code=404, detail="Playlist not found")

    local.tracks = list(source.tracks or [])
    local.updated_at = datetime.utcnow()
    borrow.last_synced_at = datetime.utcnow()
    await db.commit()
    return {"ok": True, "playlist": local.to_dict(), "message": "Playlist synced"}

