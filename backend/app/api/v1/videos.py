import uuid
from datetime import datetime
from typing import Optional, List, Dict, Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import select, func

from app.core.database import get_async_db
from app.core.deps import get_current_user, get_optional_current_user
from app.models.user import User
from app.models.video import Video
from app.models.video_comment import VideoComment
from app.models.video_like import VideoLike
from app.models.video_view import VideoView

videos_router = APIRouter(prefix="/api/v1/videos", tags=["Videos"])


class VideoCreateSchema(BaseModel):
    title: str
    description: Optional[str] = None
    url: str
    poster: Optional[str] = None
    duration: Optional[int] = None
    tags: Optional[str] = None


class VideoCommentSchema(BaseModel):
    content: str


async def _serialize_video_async(db, video: Video) -> dict:
    res = await db.execute(select(User).where(User.id == video.author_id))
    author = res.scalar_one_or_none()
    return {
        "id": video.id,
        "author_id": video.author_id,
        "title": video.title,
        "description": video.description,
        "url": video.url,
        "poster": video.poster,
        "duration": video.duration,
        "created_at": video.created_at.isoformat() if video.created_at else None,
        "views": int(video.views or 0),
        "likes": int(video.likes or 0),
        "is_deleted": bool(video.is_deleted),
        "tags": video.tags,
        "author_name": getattr(author, "username", None),
        "author_avatar": getattr(author, "avatar_url", None),
        "author_premium": getattr(author, "premium", 0),
    }


@videos_router.get("")
@videos_router.get("/")
async def list_videos(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    db=Depends(get_async_db)
):
    offset = (page - 1) * per_page
    res = await db.execute(
        select(Video)
        .where(Video.is_deleted == False)
        .order_by(Video.created_at.desc())
        .offset(offset)
        .limit(per_page)
    )
    videos = res.scalars().all()
    serialized = [await _serialize_video_async(db, v) for v in videos]
    return {"videos": serialized, "page": page, "per_page": per_page}


@videos_router.post("", status_code=status.HTTP_201_CREATED)
@videos_router.post("/", status_code=status.HTTP_201_CREATED)
async def create_video(
    payload: VideoCreateSchema,
    current_user=Depends(get_current_user),
    db=Depends(get_async_db)
):
    video = Video(
        id=str(uuid.uuid4()),
        author_id=current_user.id,
        title=payload.title,
        description=payload.description,
        url=payload.url,
        poster=payload.poster,
        duration=payload.duration,
        tags=payload.tags,
    )
    db.add(video)
    await db.commit()
    data = await _serialize_video_async(db, video)
    return {"video": data, "message": "Video uploaded successfully"}


@videos_router.get("/{video_id}")
async def get_video(
    video_id: str,
    db=Depends(get_async_db)
):
    res = await db.execute(select(Video).where(Video.id == video_id, Video.is_deleted == False))
    video = res.scalar_one_or_none()
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")

    video.views = (video.views or 0) + 1
    await db.commit()
    return {"video": await _serialize_video_async(db, video)}


@videos_router.post("/{video_id}/like")
async def like_video(
    video_id: str,
    current_user=Depends(get_current_user),
    db=Depends(get_async_db)
):
    res = await db.execute(select(Video).where(Video.id == video_id))
    video = res.scalar_one_or_none()
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")

    res_l = await db.execute(
        select(VideoLike).where(VideoLike.video_id == video_id, VideoLike.user_id == current_user.id)
    )
    existing = res_l.scalar_one_or_none()

    if existing:
        await db.delete(existing)
        video.likes = max(0, (video.likes or 0) - 1)
        liked = False
    else:
        new_like = VideoLike(id=str(uuid.uuid4()), video_id=video_id, user_id=current_user.id)
        db.add(new_like)
        video.likes = (video.likes or 0) + 1
        liked = True

    await db.commit()
    return {"liked": liked, "likes_count": video.likes}


@videos_router.get("/{video_id}/comments")
async def get_comments(
    video_id: str,
    db=Depends(get_async_db)
):
    res = await db.execute(
        select(VideoComment)
        .where(VideoComment.video_id == video_id)
        .order_by(VideoComment.created_at.desc())
    )
    comments = res.scalars().all()
    return {"comments": [{"id": c.id, "posted_by": c.posted_by, "content": c.content, "created_at": c.created_at.isoformat()} for c in comments]}


@videos_router.post("/{video_id}/comments", status_code=status.HTTP_201_CREATED)
async def add_comment(
    video_id: str,
    payload: VideoCommentSchema,
    current_user=Depends(get_current_user),
    db=Depends(get_async_db)
):
    comment = VideoComment(
        id=str(uuid.uuid4()),
        video_id=video_id,
        posted_by=current_user.id,
        content=payload.content,
    )
    db.add(comment)
    await db.commit()
    return {"comment": {"id": comment.id, "posted_by": comment.posted_by, "content": comment.content, "created_at": comment.created_at.isoformat()}}


class VideoUpdateSchema(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    poster: Optional[str] = None
    tags: Optional[str] = None
    allow_comments: Optional[bool] = None


@videos_router.patch("/{video_id}")
@videos_router.put("/{video_id}")
async def update_video(
    video_id: str,
    payload: VideoUpdateSchema,
    current_user=Depends(get_current_user),
    db=Depends(get_async_db)
):
    res = await db.execute(select(Video).where(Video.id == video_id))
    video = res.scalar_one_or_none()
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    if str(video.author_id) != str(current_user.id) and getattr(current_user, "role", "").lower() not in ("admin",):
        raise HTTPException(status_code=403, detail="Forbidden")

    data = payload.model_dump(exclude_unset=True)
    for k, v in data.items():
        if hasattr(video, k):
            setattr(video, k, v)
    video.updated_at = datetime.utcnow()
    await db.commit()
    return {"ok": True, "video": await _serialize_video_async(db, video)}


@videos_router.delete("/{video_id}")
async def delete_video(
    video_id: str,
    current_user=Depends(get_current_user),
    db=Depends(get_async_db)
):
    res = await db.execute(select(Video).where(Video.id == video_id))
    video = res.scalar_one_or_none()
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    if str(video.author_id) != str(current_user.id) and getattr(current_user, "role", "").lower() not in ("admin",):
        raise HTTPException(status_code=403, detail="Forbidden")

    video.is_deleted = True
    await db.commit()
    return {"ok": True, "message": "Video deleted"}


@videos_router.post("/like")
async def toggle_video_like(
    payload: Dict[str, Any],
    current_user=Depends(get_current_user),
    db=Depends(get_async_db)
):
    video_id = payload.get("video_id") or payload.get("id")
    if not video_id:
        raise HTTPException(status_code=400, detail="video_id is required")
    return await like_video(video_id=str(video_id), current_user=current_user, db=db)


@videos_router.post("/view")
async def record_video_view(
    payload: Dict[str, Any],
    current_user: Optional[User] = Depends(get_optional_current_user),
    db=Depends(get_async_db)
):
    video_id = payload.get("video_id") or payload.get("id")
    if not video_id:
        raise HTTPException(status_code=400, detail="video_id is required")
    res = await db.execute(select(Video).where(Video.id == str(video_id)))
    video = res.scalar_one_or_none()
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    video.views = (video.views or 0) + 1
    await db.commit()
    return {"ok": True, "views": video.views}


@videos_router.post("/later")
async def toggle_watch_later(
    payload: Dict[str, Any],
    current_user=Depends(get_current_user),
    db=Depends(get_async_db)
):
    video_id = str(payload.get("video_id") or payload.get("id") or "")
    if not video_id:
        raise HTTPException(status_code=400, detail="video_id is required")
    action = str(payload.get("action") or "add").lower()

    import json as _json
    items = []
    if current_user.video_watch_later:
        try:
            items = _json.loads(current_user.video_watch_later) or []
        except Exception:
            items = []
    items = [x for x in items if x != video_id]
    if action != "remove":
        items.insert(0, video_id)
    current_user.video_watch_later = _json.dumps(items)
    await db.commit()
    return {"ok": True, "watch_later": items}


@videos_router.get("/later")
async def list_watch_later(
    current_user=Depends(get_current_user),
    db=Depends(get_async_db)
):
    import json as _json
    items = []
    if current_user.video_watch_later:
        try:
            items = _json.loads(current_user.video_watch_later) or []
        except Exception:
            items = []
    if not items:
        return {"videos": []}
    res = await db.execute(select(Video).where(Video.id.in_(items), Video.is_deleted == False))
    videos = res.scalars().all()
    by_id = {v.id: v for v in videos}
    ordered = [await _serialize_video_async(db, by_id[i]) for i in items if i in by_id]
    return {"videos": ordered}


@videos_router.get("/my")
async def my_videos(
    current_user=Depends(get_current_user),
    db=Depends(get_async_db)
):
    res = await db.execute(
        select(Video)
        .where(Video.author_id == current_user.id, Video.is_deleted == False)
        .order_by(Video.created_at.desc())
    )
    videos = res.scalars().all()
    serialized = [await _serialize_video_async(db, v) for v in videos]
    return {"videos": serialized}


@videos_router.get("/liked")
async def liked_videos(
    current_user=Depends(get_current_user),
    db=Depends(get_async_db)
):
    res = await db.execute(
        select(VideoLike).where(VideoLike.user_id == current_user.id)
    )
    likes = res.scalars().all()
    vids = [l.video_id for l in likes]
    if not vids:
        return {"videos": []}
    res_v = await db.execute(
        select(Video).where(Video.id.in_(vids), Video.is_deleted == False)
    )
    videos = res_v.scalars().all()
    serialized = [await _serialize_video_async(db, v) for v in videos]
    return {"videos": serialized}


@videos_router.post("/check")
async def check_video(
    payload: Dict[str, Any],
    db=Depends(get_async_db)
):
    video_id = payload.get("video_id") or payload.get("id")
    if not video_id:
        return {"valid": False}
    res = await db.execute(select(Video).where(Video.id == str(video_id), Video.is_deleted == False))
    video = res.scalar_one_or_none()
    return {"valid": bool(video), "video": await _serialize_video_async(db, video) if video else None}


@videos_router.post("/comments", status_code=status.HTTP_201_CREATED)
async def add_comment_body(
    payload: Dict[str, Any],
    current_user=Depends(get_current_user),
    db=Depends(get_async_db)
):
    video_id = payload.get("video_id")
    content = payload.get("content")
    if not video_id or not content:
        raise HTTPException(status_code=400, detail="video_id and content required")
    return await add_comment(video_id=str(video_id), payload=VideoCommentSchema(content=str(content)), current_user=current_user, db=db)


@videos_router.get("/comments/{video_id}")
async def get_comments_alias(
    video_id: str,
    db=Depends(get_async_db)
):
    return await get_comments(video_id=video_id, db=db)

