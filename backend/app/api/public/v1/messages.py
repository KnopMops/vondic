from fastapi import APIRouter

public_messages_router = APIRouter(prefix="/api/public/v1/messages", tags=["Public Messages"])


@public_messages_router.get("")
@public_messages_router.get("/")
async def public_messages_list():
    return {"messages": []}
