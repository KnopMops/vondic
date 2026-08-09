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
