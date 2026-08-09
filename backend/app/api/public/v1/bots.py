from fastapi import APIRouter

public_bots_router = APIRouter(prefix="/api/public/v1/bots", tags=["Public Bots"])


@public_bots_router.get("")
@public_bots_router.get("/")
async def public_bots_list():
    return {"bots": []}
