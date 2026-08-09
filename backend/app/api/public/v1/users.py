from fastapi import APIRouter

public_users_router = APIRouter(prefix="/api/public/v1/users", tags=["Public Users"])


@public_users_router.get("")
@public_users_router.get("/")
async def public_users_list():
    return {"users": []}
