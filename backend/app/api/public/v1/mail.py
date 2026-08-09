from fastapi import APIRouter

public_mail_router = APIRouter(prefix="/api/public/v1/mail", tags=["Public Mail"])


@public_mail_router.get("")
@public_mail_router.get("/")
async def public_mail_list():
    return {"mail": []}
