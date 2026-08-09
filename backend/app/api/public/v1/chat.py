from fastapi import APIRouter

public_chat_router = APIRouter(prefix="/api/public/v1/chat", tags=["Public Chat"])


@public_chat_router.get("")
@public_chat_router.get("/")
async def public_chat_list():
    return {"chats": []}
