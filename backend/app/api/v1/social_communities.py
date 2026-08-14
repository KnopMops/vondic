from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.core.deps import get_current_user
from app.services.social_community_service import SocialCommunityService

social_communities_router = APIRouter(
    prefix="/api/v1/social-communities",
    tags=["Social Communities"]
)


class SocialCommunityCreateSchema(BaseModel):
    name: str
    description: Optional[str] = None
    avatar_url: Optional[str] = None
    cover_url: Optional[str] = None
    is_public: Optional[bool] = True


class SocialCommunityJoinSchema(BaseModel):
    invite_code: Optional[str] = None
    community_id: Optional[str] = None
    id: Optional[str] = None


class SocialCommunityLeaveSchema(BaseModel):
    community_id: str


@social_communities_router.post("", status_code=status.HTTP_201_CREATED)
@social_communities_router.post("/", status_code=status.HTTP_201_CREATED)
async def create_social_community(
    payload: SocialCommunityCreateSchema,
    current_user=Depends(get_current_user)
):
    community, err = SocialCommunityService.create(payload.model_dump(), current_user.id)
    if err or not community:
        raise HTTPException(status_code=400, detail=err or "Failed to create social community")
    return {"community": community.to_dict() if hasattr(community, "to_dict") else community}


@social_communities_router.post("/my")
@social_communities_router.get("/my")
async def my_social_communities(current_user=Depends(get_current_user)):
    items = SocialCommunityService.get_user_communities(current_user.id)
    return {"communities": [c.to_dict() if hasattr(c, "to_dict") else c for c in items]}


@social_communities_router.post("/search")
@social_communities_router.get("/search")
async def search_social_communities(
    query: Optional[str] = None,
    current_user=Depends(get_current_user)
):
    items = SocialCommunityService.search(query or "", current_user.id)
    return {"communities": [c.to_dict() if hasattr(c, "to_dict") else c for c in items]}


@social_communities_router.post("/join")
async def join_social_community(
    payload: SocialCommunityJoinSchema,
    current_user=Depends(get_current_user)
):
    code = payload.invite_code or payload.community_id or payload.id or ""
    if not code:
        raise HTTPException(status_code=400, detail="invite_code or community_id required")
    community, err = SocialCommunityService.join(code, current_user.id)
    if err or not community:
        raise HTTPException(status_code=400, detail=err or "Failed to join community")
    return {"community": community.to_dict() if hasattr(community, "to_dict") else community}


@social_communities_router.post("/leave")
async def leave_social_community(
    payload: SocialCommunityLeaveSchema,
    current_user=Depends(get_current_user)
):
    ok, err = SocialCommunityService.leave(payload.community_id, current_user.id)
    if not ok:
        raise HTTPException(status_code=400, detail=err or "Failed to leave community")
    return {"message": "Left community"}


@social_communities_router.post("/{community_id}")
@social_communities_router.get("/{community_id}")
async def social_community_info(
    community_id: str,
    current_user=Depends(get_current_user)
):
    community = SocialCommunityService.get_by_id(community_id)
    if not community:
        raise HTTPException(status_code=404, detail="Community not found")
    return {"community": community.to_dict() if hasattr(community, "to_dict") else community}
