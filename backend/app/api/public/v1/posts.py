from fastapi import APIRouter

public_posts_router = APIRouter(prefix="/api/public/v1/posts", tags=["Public Posts"])


@public_posts_router.get("")
@public_posts_router.get("/")
async def public_posts_list():
    return {"posts": []}
