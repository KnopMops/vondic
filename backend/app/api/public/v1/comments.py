from fastapi import APIRouter

public_comments_router = APIRouter(prefix="/api/public/v1/comments", tags=["Public Comments"])


@public_comments_router.get("")
@public_comments_router.get("/")
async def public_comments_list():
    return {"comments": []}
