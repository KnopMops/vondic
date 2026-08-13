from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from app.core.deps import get_current_user
from app.services.post_service import PostService
from app.services.user_service import UserService

search_router = APIRouter(prefix="/api/v1/search", tags=["Search"])


class SearchQuerySchema(BaseModel):
    query: str


@search_router.post("")
@search_router.post("/")
async def global_search(
    payload: SearchQuerySchema,
    current_user=Depends(get_current_user)
):
    query = payload.query.strip()
    if not query:
        return {"results": [], "type": "empty"}

    if query.startswith("@"):
        term = query[1:].strip()
        if not term:
            return {"results": [], "type": "users"}
        users = UserService.search_users(term)
        return {
            "type": "users",
            "results": [u.to_dict(viewer_id=current_user.id) for u in users]
        }
    elif query.startswith("#"):
        term = query[1:].strip()
        if not term:
            return {"results": [], "type": "posts"}
        posts = PostService.search_posts(term)
        return {
            "type": "posts",
            "results": [p.to_dict(viewer_id=current_user.id) for p in posts]
        }
    else:
        users = UserService.search_users(query)
        from app.services.bot_service import BotService
        bots = BotService.search_active_bots(query)
        posts = PostService.search_posts(query)

        user_list = [u.to_dict(viewer_id=current_user.id) for u in users]
        bot_list = [b.to_dict() if hasattr(b, "to_dict") else b for b in bots]
        post_list = [p.to_dict(viewer_id=current_user.id) for p in posts]

        return {
            "type": "all",
            "users": user_list,
            "bots": bot_list,
            "posts": post_list,
            "results": user_list + bot_list,
        }
