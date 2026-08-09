import secrets

from fastapi import Depends, HTTPException
from sqlalchemy import select

from app.api.v1.users import users_router
from app.core.database import get_async_db
from app.core.deps import get_current_user
from app.models.user import User


@users_router.post("/link-key")
async def generate_link_key(
    current_user=Depends(get_current_user),
    db=Depends(get_async_db)
):
    try:
        key = secrets.token_hex(3)
        res = await db.execute(select(User).where(User.id == current_user.id))
        user = res.scalar_one_or_none()
        if user:
            user.link_key = key
            await db.commit()
        return {"link_key": key}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
