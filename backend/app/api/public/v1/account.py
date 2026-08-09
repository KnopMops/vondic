from fastapi import APIRouter

public_account_router = APIRouter(prefix="/api/public/v1/account", tags=["Public Account"])


@public_account_router.get("")
@public_account_router.get("/")
async def public_account_info():
    return {"account": None}
