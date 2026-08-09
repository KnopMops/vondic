import uuid
from datetime import datetime
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select

from app.core.database import get_async_db
from app.core.deps import get_current_user
from app.models.poll import Poll, PollVote

polls_router = APIRouter(prefix="/api/v1/polls", tags=["Polls"])


class PollCreateSchema(BaseModel):
    question: str
    options: List[str]
    is_anonymous: Optional[bool] = True
    multiple_choice: Optional[bool] = False


class PollVoteSchema(BaseModel):
    option_id: str


@polls_router.post("", status_code=status.HTTP_201_CREATED)
@polls_router.post("/", status_code=status.HTTP_201_CREATED)
async def create_poll(
    payload: PollCreateSchema,
    current_user=Depends(get_current_user),
    db=Depends(get_async_db)
):
    question = payload.question.strip()
    if not question or len(payload.options) < 2:
        raise HTTPException(status_code=400, detail="question and at least 2 options required")

    poll_options = [{"id": uuid.uuid4().hex[:8], "text": str(o)} for o in payload.options]
    poll = Poll(
        id=uuid.uuid4().hex[:16],
        question=question,
        options=poll_options,
        is_anonymous=payload.is_anonymous if payload.is_anonymous is not None else True,
        multiple_choice=payload.multiple_choice if payload.multiple_choice is not None else False,
    )
    db.add(poll)
    await db.commit()
    return poll.to_dict()


@polls_router.get("/{poll_id}")
async def get_poll(
    poll_id: str,
    current_user=Depends(get_current_user),
    db=Depends(get_async_db)
):
    res = await db.execute(select(Poll).where(Poll.id == poll_id))
    poll = res.scalar_one_or_none()
    if not poll:
        raise HTTPException(status_code=404, detail="Poll not found")
    return poll.to_dict()


@polls_router.post("/{poll_id}/vote")
async def vote_poll(
    poll_id: str,
    payload: PollVoteSchema,
    current_user=Depends(get_current_user),
    db=Depends(get_async_db)
):
    res = await db.execute(select(Poll).where(Poll.id == poll_id))
    poll = res.scalar_one_or_none()
    if not poll:
        raise HTTPException(status_code=404, detail="Poll not found")

    if poll.expires_at and poll.expires_at < datetime.utcnow():
        raise HTTPException(status_code=400, detail="Poll expired")

    valid_ids = {o["id"] for o in poll.options}
    if payload.option_id not in valid_ids:
        raise HTTPException(status_code=400, detail="Invalid option")

    vote_obj = PollVote(poll_id=poll_id, user_id=str(current_user.id), option_id=payload.option_id)
    db.add(vote_obj)
    await db.commit()

    return poll.to_dict()
