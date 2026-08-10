import hashlib
import os
import time
from typing import Optional, List, Dict, Any

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from sqlalchemy import select

from app.core.database import get_async_db
from app.core.deps import get_current_user, get_optional_current_user
from app.models.notification import Notification
from app.models.user import User
from app.models.post import Post
from app.services.comment_service import CommentService
from app.services.post_service import PostService

posts_router = APIRouter(prefix="/api/v1/posts", tags=["Posts"])


class PostCreateSchema(BaseModel):
    title: Optional[str] = None
    content: str
    attachments: Optional[List[Dict[str, Any]]] = None
    community_id: Optional[str] = None


class CommentCreateSchema(BaseModel):
    content: str
    parent_id: Optional[str] = None


async def _attach_author_to_post_async(db_session, post_dict: dict) -> None:
    posted_by = post_dict.get("posted_by")
    if not posted_by:
        return
    res = await db_session.execute(select(User).where(User.id == posted_by))
    author = res.scalar_one_or_none()
    if not author:
        return
    post_dict["author_name"] = author.username
    post_dict["author_avatar"] = author.avatar_url
    post_dict["author_premium"] = bool(author.premium)
    post_dict["author"] = {
        "id": author.id,
        "username": author.username,
        "avatar_url": author.avatar_url,
        "premium": bool(author.premium),
    }


async def _attach_authors_to_posts_async(db_session, items: list) -> None:
    author_ids = {p.get("posted_by") for p in items if p.get("posted_by")}
    if not author_ids:
        return
    res = await db_session.execute(select(User).where(User.id.in_(author_ids)))
    authors = {u.id: u for u in res.scalars().all()}
    for post in items:
        author = authors.get(post.get("posted_by"))
        if author:
            post["author_name"] = author.username
            post["author_avatar"] = author.avatar_url
            post["author_premium"] = bool(author.premium)
            post["author"] = {
                "id": author.id,
                "username": author.username,
                "avatar_url": author.avatar_url,
                "premium": bool(author.premium),
            }


@posts_router.get("", response_model=Dict[str, Any])
@posts_router.get("/", response_model=Dict[str, Any])
async def get_posts(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    community_id: Optional[str] = None,
    current_user: Optional[User] = Depends(get_optional_current_user),
    db=Depends(get_async_db)
):
    viewer_id = current_user.id if current_user else None
    items, total, current_page, pages = PostService.get_posts_paginated(
        page, per_page, viewer_id=viewer_id, community_id=community_id
    )
    dicts = [p.to_dict(viewer_id=viewer_id) for p in items]
    await _attach_authors_to_posts_async(db, dicts)
    return {
        "posts": dicts,
        "total": total,
        "page": current_page,
        "pages": pages,
    }


@posts_router.post("", response_model=Dict[str, Any], status_code=status.HTTP_201_CREATED)
@posts_router.post("/", response_model=Dict[str, Any], status_code=status.HTTP_201_CREATED)
async def create_post(
    payload: PostCreateSchema,
    current_user: User = Depends(get_current_user),
    db=Depends(get_async_db)
):
    post, err = PostService.create_post(
        posted_by=current_user.id,
        content=payload.content,
        title=payload.title,
        attachments=payload.attachments,
        community_id=payload.community_id,
    )
    if err or not post:
        raise HTTPException(status_code=400, detail=err or "Failed to create post")
    pdict = post.to_dict(viewer_id=current_user.id)
    await _attach_author_to_post_async(db, pdict)
    return {"post": pdict, "message": "Post created"}


@posts_router.get("/feed", response_model=Dict[str, Any])
async def get_feed(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    current_user: Optional[User] = Depends(get_optional_current_user),
    db=Depends(get_async_db)
):
    user_id = current_user.id if current_user else None
    if user_id:
        items, total, cpage, pages = PostService.get_feed_paginated(
            user_id, page, per_page
        )
    else:
        items, total, cpage, pages = PostService.get_posts_paginated(
            page, per_page
        )

    if not items and user_id and page == 1:
        items, total, cpage, pages = PostService.get_posts_paginated(
            page, per_page, viewer_id=user_id
        )

    dicts = [p.to_dict(viewer_id=user_id) for p in items]
    await _attach_authors_to_posts_async(db, dicts)
    return {
        "posts": dicts,
        "total": total,
        "page": cpage,
        "pages": pages,
    }



@posts_router.get("/{post_id}", response_model=Dict[str, Any])
async def get_post(
    post_id: str,
    current_user: Optional[User] = Depends(get_optional_current_user),
    db=Depends(get_async_db)
):
    viewer_id = current_user.id if current_user else None
    post, err = PostService.get_post_by_id(post_id, viewer_id=viewer_id)
    if err or not post:
        raise HTTPException(status_code=404, detail="Post not found")
    pdict = post.to_dict(viewer_id=viewer_id)
    await _attach_author_to_post_async(db, pdict)
    return {"post": pdict}


@posts_router.delete("/{post_id}", response_model=Dict[str, Any])
async def delete_post(
    post_id: str,
    current_user: User = Depends(get_current_user)
):
    ok, err = PostService.delete_post(post_id, current_user.id)
    if not ok:
        raise HTTPException(status_code=400, detail=err or "Cannot delete post")
    return {"message": "Post deleted"}


@posts_router.post("/{post_id}/like", response_model=Dict[str, Any])
async def like_post(
    post_id: str,
    current_user: User = Depends(get_current_user)
):
    liked, likes_count, err = PostService.toggle_like(current_user.id, post_id=post_id)
    if err:
        raise HTTPException(status_code=400, detail=err)
    return {"liked": liked, "likes_count": likes_count}


@posts_router.get("/{post_id}/comments", response_model=Dict[str, Any])
async def get_comments(
    post_id: str,
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=100),
    current_user: Optional[User] = Depends(get_optional_current_user),
    db=Depends(get_async_db)
):
    viewer_id = current_user.id if current_user else None
    items, total, cpage, pages = CommentService.get_comments_for_post(
        post_id, page=page, per_page=per_page, viewer_id=viewer_id
    )
    dicts = [c.to_dict() for c in items]
    await _attach_authors_to_posts_async(db, dicts)
    return {
        "comments": dicts,
        "total": total,
        "page": cpage,
        "pages": pages,
    }


@posts_router.post("/{post_id}/comments", response_model=Dict[str, Any], status_code=status.HTTP_201_CREATED)
async def create_comment(
    post_id: str,
    payload: CommentCreateSchema,
    current_user: User = Depends(get_current_user),
    db=Depends(get_async_db)
):
    try:
        comment = CommentService.create_comment(
            data={"content": payload.content, "parent_id": payload.parent_id},
            user_id=current_user.id,
            post_id=post_id,
        )
        cdict = comment.to_dict()
        await _attach_author_to_post_async(db, cdict)
        return {"comment": cdict, "message": "Comment added"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

