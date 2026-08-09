from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.core.deps import get_current_user
from app.services.subscription_service import SubscriptionService

subscriptions_router = APIRouter(prefix="/api/v1/subscriptions", tags=["Subscriptions"])


class SubscriptionActionSchema(BaseModel):
    target_id: Optional[str] = None
    user_id: Optional[str] = None


@subscriptions_router.post("/subscribe", status_code=status.HTTP_201_CREATED)
async def subscribe(
    payload: SubscriptionActionSchema,
    current_user=Depends(get_current_user)
):
    if not payload.target_id:
        raise HTTPException(status_code=400, detail="target_id is required")

    sub, error = SubscriptionService.subscribe(current_user.id, payload.target_id)
    if error or not sub:
        raise HTTPException(status_code=400, detail=error or "Failed to subscribe")
    return sub.to_dict() if hasattr(sub, "to_dict") else {"subscription": sub}


@subscriptions_router.post("/unsubscribe")
async def unsubscribe(
    payload: SubscriptionActionSchema,
    current_user=Depends(get_current_user)
):
    if not payload.target_id:
        raise HTTPException(status_code=400, detail="target_id is required")

    success, error = SubscriptionService.unsubscribe(current_user.id, payload.target_id)
    if error:
        raise HTTPException(status_code=400, detail=error)
    return {"message": "Unsubscribed successfully"}


@subscriptions_router.post("/followers")
@subscriptions_router.get("/followers")
async def get_followers(
    payload: Optional[SubscriptionActionSchema] = None,
    current_user=Depends(get_current_user)
):
    uid = (payload.user_id if payload else None) or current_user.id
    followers = SubscriptionService.get_followers(uid)
    return {"followers": followers}


@subscriptions_router.post("/following")
@subscriptions_router.get("/following")
async def get_following(
    payload: Optional[SubscriptionActionSchema] = None,
    current_user=Depends(get_current_user)
):
    uid = (payload.user_id if payload else None) or current_user.id
    following = SubscriptionService.get_following(uid)
    return {"following": following}
