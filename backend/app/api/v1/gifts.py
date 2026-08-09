import re
import uuid
from typing import Optional, List, Dict, Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select

from app.core.database import get_async_db
from app.core.deps import get_current_user
from app.models.gift_catalog import GiftCatalog
from app.models.user import User

gifts_router = APIRouter(prefix="/api/v1/gifts", tags=["Gifts"])


class GiftCreateSchema(BaseModel):
    name: str
    price: int = 0
    icon: Optional[str] = None
    description: Optional[str] = None
    image_url: Optional[str] = None
    total_supply: Optional[int] = None


class GiftSendSchema(BaseModel):
    gift_id: str
    recipient_id: str
    message: Optional[str] = None


@gifts_router.get("")
@gifts_router.get("/")
async def list_gifts(db=Depends(get_async_db)):
    res = await db.execute(select(GiftCatalog).order_by(GiftCatalog.price.asc()))
    gifts = res.scalars().all()
    return [g.to_dict() for g in gifts]


@gifts_router.post("/admin/create", status_code=status.HTTP_201_CREATED)
async def create_gift(
    payload: GiftCreateSchema,
    current_user=Depends(get_current_user),
    db=Depends(get_async_db)
):
    if getattr(current_user, "role", "") != "Admin":
        raise HTTPException(status_code=403, detail="Forbidden")

    gid = re.sub(r"\s+", "_", payload.name.strip().lower())
    gid = re.sub(r"[^a-z0-9_]+", "", gid) or "gift"

    res = await db.execute(select(GiftCatalog).where(GiftCatalog.id == gid))
    if res.scalar_one_or_none():
        gid = f"{gid}_{uuid.uuid4().hex[:6]}"

    gift = GiftCatalog(
        id=gid,
        name=payload.name.strip(),
        price=payload.price,
        icon=payload.icon,
        description=payload.description,
        image_url=payload.image_url,
        total_supply=payload.total_supply,
        minted_count=0
    )
    db.add(gift)
    await db.commit()
    return gift.to_dict()


@gifts_router.post("/send")
async def send_gift(
    payload: GiftSendSchema,
    current_user=Depends(get_current_user),
    db=Depends(get_async_db)
):
    res_g = await db.execute(select(GiftCatalog).where(GiftCatalog.id == payload.gift_id))
    gift = res_g.scalar_one_or_none()
    if not gift:
        raise HTTPException(status_code=404, detail="Gift not found")

    res_u = await db.execute(select(User).where(User.id == current_user.id))
    sender = res_u.scalar_one_or_none()

    if (sender.balance or 0.0) < gift.price:
        raise HTTPException(status_code=400, detail="Insufficient balance")

    sender.balance -= gift.price
    gift.minted_count = (gift.minted_count or 0) + 1
    await db.commit()

    return {"success": True, "message": "Gift sent successfully"}
