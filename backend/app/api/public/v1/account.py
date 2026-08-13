from fastapi import APIRouter, Depends, HTTPException
from app.core.deps import get_current_user
from app.services.user_service import UserService

public_account_router = APIRouter(prefix="/api/public/v1/account", tags=["Public Account"])


@public_account_router.get("")
@public_account_router.get("/")
async def public_account_info():
    return {"account": None}


@public_account_router.get("/api-key")
async def get_account_api_key(current_user=Depends(get_current_user)):
    api_key, error = UserService.get_api_key(str(current_user.id))
    if error:
        raise HTTPException(status_code=400, detail=error)
    return {"api_key": api_key}


@public_account_router.post("/api-key")
async def generate_account_api_key(current_user=Depends(get_current_user)):
    api_key, error = UserService.generate_api_key(str(current_user.id), rotate=True)
    if error or not api_key:
        raise HTTPException(status_code=400, detail=error or "Failed to generate API key")
    return {"api_key": api_key}
