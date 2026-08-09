import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select

from app.core.database import get_async_db
from app.core.deps import get_current_user
from app.models.device import Device

devices_router = APIRouter(prefix="/api/v1/devices", tags=["Devices"])


class DeviceRegisterSchema(BaseModel):
    token: str
    platform: Optional[str] = "android"
    device_type: Optional[str] = "mobile"


@devices_router.post("/register")
async def register_device(
    payload: DeviceRegisterSchema,
    current_user=Depends(get_current_user),
    db=Depends(get_async_db)
):
    token = payload.token.strip()
    if not token:
        raise HTTPException(status_code=400, detail="token is required")

    res = await db.execute(select(Device).where(Device.token == token))
    existing = res.scalar_one_or_none()

    if existing:
        existing.user_id = current_user.id
        existing.platform = payload.platform or "android"
        existing.device_type = payload.device_type or "mobile"
        await db.commit()
        return {"ok": True, "device_id": existing.id}

    device = Device(
        id=str(uuid.uuid4()),
        user_id=str(current_user.id),
        token=token,
        platform=payload.platform or "android",
        device_type=payload.device_type or "mobile",
    )
    db.add(device)
    await db.commit()

    return {"ok": True, "device_id": device.id}
