from typing import Optional, Dict, Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel

from app.core.deps import get_current_user
from app.services.friendship_service import FriendshipService

friends_router = APIRouter(prefix="/api/v1/friends", tags=["Friends"])


class FriendListSchema(BaseModel):
    user_id: Optional[str] = None


class FriendRequestSchema(BaseModel):
    friend_id: str


class FriendActionSchema(BaseModel):
    friendship_id: str


@friends_router.post("/list")
@friends_router.get("/list")
async def get_friends(
    user_id: Optional[str] = Query(None),
    payload: Optional[Dict[str, Any]] = None,
    current_user=Depends(get_current_user)
):
    target_user_id = user_id
    if not target_user_id and payload:
        target_user_id = payload.get("user_id") or payload.get("id")
    if not target_user_id:
        target_user_id = current_user.id

    friends = FriendshipService.get_friends(target_user_id)
    return {"friends": friends}


@friends_router.post("/requests")
@friends_router.get("/requests")
async def get_requests(
    user_id: Optional[str] = Query(None),
    payload: Optional[Dict[str, Any]] = None,
    current_user=Depends(get_current_user)
):
    target_user_id = user_id
    if not target_user_id and payload:
        target_user_id = payload.get("user_id") or payload.get("id")
    if not target_user_id:
        target_user_id = current_user.id

    requests = FriendshipService.get_pending_requests(target_user_id)
    return {"requests": requests}


@friends_router.post("/request", status_code=status.HTTP_201_CREATED)
async def send_request(
    payload: FriendRequestSchema,
    current_user=Depends(get_current_user)
):
    friendship, error = FriendshipService.send_request(current_user.id, payload.friend_id)
    if error or not friendship:
        raise HTTPException(status_code=400, detail=error or "Failed to send request")
    return {"friendship": friendship.to_dict() if hasattr(friendship, "to_dict") else friendship}


@friends_router.post("/accept")
async def accept_request(
    payload: FriendActionSchema,
    current_user=Depends(get_current_user)
):
    friendship, error = FriendshipService.accept_request(payload.friendship_id, current_user.id)
    if error:
        raise HTTPException(status_code=400, detail=error)
    return {"message": "Friend request accepted"}


@friends_router.post("/reject")
async def reject_request(
    payload: FriendActionSchema,
    current_user=Depends(get_current_user)
):
    success, error = FriendshipService.reject_request(payload.friendship_id, current_user.id)
    if error:
        raise HTTPException(status_code=400, detail=error)
    return {"message": "Friend request rejected"}
