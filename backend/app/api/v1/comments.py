from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.core.deps import get_current_user
from app.services.comment_service import CommentService

comments_router = APIRouter(prefix="/api/v1/comments", tags=["Comments"])


class CommentUpdateSchema(BaseModel):
    comment_id: str
    content: Optional[str] = None


class CommentDeleteSchema(BaseModel):
    comment_id: str
    user_id: str
    reason: Optional[str] = None


@comments_router.put("", response_model=dict)
@comments_router.put("/", response_model=dict)
async def update_comment(
    payload: CommentUpdateSchema,
    current_user=Depends(get_current_user)
):
    is_admin = getattr(current_user, "role", "") == "Admin"
    comment = CommentService.update_comment(
        payload.comment_id, payload.model_dump(exclude_unset=True), current_user.id, is_admin
    )
    return comment.to_dict() if hasattr(comment, "to_dict") else {"comment": comment}


@comments_router.delete("", response_model=dict)
@comments_router.delete("/", response_model=dict)
async def delete_comment(
    payload: CommentDeleteSchema,
    current_user=Depends(get_current_user)
):
    if str(payload.user_id) != str(current_user.id):
        raise HTTPException(status_code=403, detail="Несоответствие ID пользователя")

    CommentService.delete_comment_by_user(payload.comment_id, payload.user_id)
    return {"message": "Комментарий успешно удалён"}


@comments_router.delete("/admin", response_model=dict)
async def delete_comment_admin(
    payload: CommentDeleteSchema,
    current_user=Depends(get_current_user)
):
    if getattr(current_user, "role", "") != "Admin":
        raise HTTPException(status_code=403, detail="Неавторизовано")

    if not payload.reason:
        raise HTTPException(status_code=400, detail="Reason is required")

    CommentService.delete_comment_by_admin(payload.comment_id, current_user.id, payload.reason)
    return {"message": "Комментарий успешно удалён админом"}
