from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select

from app.core.database import get_async_db
from app.core.deps import get_current_user, get_optional_current_user
from app.models.join_request import JoinRequest
from app.models.user import User
from app.models.group import Group
from app.models.channel import Channel
from app.models.community import Community

join_requests_router = APIRouter(prefix="/api/v1/join-requests", tags=["Join Requests"])


class JoinRequestCreateSchema(BaseModel):
    target_type: str  # group, channel, community
    target_id: str


class JoinRequestActionSchema(BaseModel):
    request_id: str


import time

def push_join_request_bot_message(req_id: str, owner_id: str, target_name: str, target_type: str, applicant_user: User):
    if not owner_id:
        return
    try:
        from app.api.public.v1.bots import OUTBOX_QUEUES
        BOT_ID = "7e140ffc-5549-418a-8bad-525c02193812"
        target_type_ru = "канал" if target_type == "channel" else ("сервер" if target_type == "community" else "группу")
        applicant_name = getattr(applicant_user, "username", None) or getattr(applicant_user, "name", None) or applicant_user.id
        text = (
            f"📩 Новая заявка на вступление!\n\n"
            f"Пользователь @{applicant_name} хочет вступить в {target_type_ru} «{target_name}».\n\n"
            f"Нажмите кнопку ниже, чтобы принять или отклонить заявку:"
        )
        reply_markup = {
            "inline_keyboard": [
                [
                    {"text": "✅ Принять", "callback_data": f"join_approve:{req_id}"},
                    {"text": "❌ Отклонить", "callback_data": f"join_decline:{req_id}"}
                ]
            ]
        }
        item = {
            "bot_id": BOT_ID,
            "chat_id": str(owner_id),
            "text": text,
            "reply_markup": reply_markup,
            "created_at": time.time(),
        }
        OUTBOX_QUEUES[f"{BOT_ID}:{owner_id}"].append(item)

        try:
            import os
            import requests
            from datetime import datetime
            from app.services.message_service import MessageService

            msg_obj, _ = MessageService.create_message(
                {"content": text, "type": "text"},
                user_id=BOT_ID,
                target_id=str(owner_id),
            )

            msg_id = getattr(msg_obj, "id", None) if msg_obj else f"join_req_{int(time.time()*1000)}"
            iso_time = datetime.utcnow().isoformat() + "Z"

            webrtc_url = os.getenv("WEBRTC_INTERNAL_URL", "http://webrtc:5000")
            broadcast_payload = {
                "target_id": str(owner_id),
                "payload": {
                    "id": msg_id,
                    "sender_id": BOT_ID,
                    "target_id": str(owner_id),
                    "content": text,
                    "reply_markup": reply_markup,
                    "type": "text",
                    "timestamp": iso_time,
                    "is_read": 0,
                }
            }
            requests.post(f"{webrtc_url}/internal/broadcast_message", json=broadcast_payload, timeout=2)
        except Exception as e:
            print(f"Error broadcasting join request message: {e}")
    except Exception:
        pass


def push_join_request_decision_message(req: JoinRequest, target_name: str):
    try:
        from app.api.public.v1.bots import OUTBOX_QUEUES
        BOT_ID = "7e140ffc-5549-418a-8bad-525c02193812"
        if req.status == "approved":
            text = f"🎉 Ваша заявка на вступление в «{target_name}» была одобрена! Вы успешно добавлены."
        else:
            text = f"❌ Ваша заявка на вступление в «{target_name}» была отклонена администратором."

        item = {
            "bot_id": BOT_ID,
            "chat_id": str(req.user_id),
            "text": text,
            "created_at": time.time(),
        }
        OUTBOX_QUEUES[f"{BOT_ID}:{req.user_id}"].append(item)
    except Exception:
        pass


@join_requests_router.get("/my")
async def get_my_join_requests(
    current_user=Depends(get_current_user),
    db=Depends(get_async_db)
):
    res = await db.execute(select(JoinRequest).where(JoinRequest.user_id == current_user.id))
    requests = res.scalars().all()
    return {"requests": [r.to_dict() for r in requests]}


@join_requests_router.post("/create", status_code=status.HTTP_201_CREATED)
async def create_join_request(
    payload: JoinRequestCreateSchema,
    current_user=Depends(get_current_user),
    db=Depends(get_async_db)
):
    target_name = "Чат"
    owner_id = None

    if payload.target_type == "group":
        res = await db.execute(select(Group).where(Group.id == payload.target_id))
        g = res.scalar_one_or_none()
        if g:
            target_name = g.name
            owner_id = g.owner_id
    elif payload.target_type == "channel":
        res = await db.execute(select(Channel).where(Channel.id == payload.target_id))
        ch = res.scalar_one_or_none()
        if ch:
            target_name = ch.name
            owner_id = ch.owner_id
    elif payload.target_type == "community":
        res = await db.execute(select(Community).where(Community.id == payload.target_id))
        c = res.scalar_one_or_none()
        if c:
            target_name = c.name
            owner_id = c.owner_id

    req = JoinRequest(
        target_type=payload.target_type,
        target_id=payload.target_id,
        user_id=current_user.id,
        status="pending",
    )
    db.add(req)
    await db.commit()
    await db.refresh(req)

    push_join_request_bot_message(req.id, owner_id, target_name, payload.target_type, current_user)

    return {
        "message": "Заявка отправлена администраторам",
        "request": req.to_dict(),
        "details": {
            "applicant": {
                "id": current_user.id,
                "username": current_user.username,
                "profile_url": f"/feed/profile/{current_user.id}",
            },
            "target_name": target_name,
            "owner_id": owner_id,
        }
    }


@join_requests_router.post("/approve")
async def approve_join_request(
    payload: JoinRequestActionSchema,
    current_user=Depends(get_optional_current_user),
    db=Depends(get_async_db)
):
    res = await db.execute(select(JoinRequest).where(JoinRequest.id == payload.request_id))
    req = res.scalar_one_or_none()
    if not req:
        raise HTTPException(status_code=404, detail="Заявка не найдена")

    req.status = "approved"
    target_name = "Чат"

    requester_id = current_user.id if current_user else "bot"

    # Directly add user to target group / channel / community
    from app.models.user import User
    u = User.query.get(req.user_id)

    if req.target_type == "group":
        from app.models.group import Group
        g = Group.query.get(req.target_id)
        if g:
            target_name = g.name
            if u and u not in g.participants:
                g.participants.append(u)
    elif req.target_type == "channel":
        from app.models.channel import Channel
        ch = Channel.query.get(req.target_id)
        if ch:
            target_name = ch.name
            if u and u not in ch.participants:
                ch.participants.append(u)
    elif req.target_type == "community":
        from app.models.community import Community
        c = Community.query.get(req.target_id)
        if c:
            target_name = c.name
            if u and u not in c.members:
                c.members.append(u)

    await db.commit()
    push_join_request_decision_message(req, target_name)
    return {"message": "Заявка одобрена, пользователь добавлен", "request": req.to_dict()}


@join_requests_router.post("/decline")
async def decline_join_request(
    payload: JoinRequestActionSchema,
    current_user=Depends(get_optional_current_user),
    db=Depends(get_async_db)
):
    res = await db.execute(select(JoinRequest).where(JoinRequest.id == payload.request_id))
    req = res.scalar_one_or_none()
    if not req:
        raise HTTPException(status_code=404, detail="Заявка не найдена")

    req.status = "declined"
    target_name = "Чат"
    if req.target_type == "group":
        from app.services.group_service import GroupService
        g = GroupService.get_group_by_id(req.target_id)
        if g:
            target_name = g.name
    elif req.target_type == "channel":
        from app.services.channel_service import ChannelService
        ch = ChannelService.get_channel_by_id(req.target_id)
        if ch:
            target_name = ch.name
    elif req.target_type == "community":
        from app.services.community_service import CommunityService
        c = CommunityService.get_by_id(req.target_id)
        if c:
            target_name = c.name

    await db.commit()
    push_join_request_decision_message(req, target_name)
    return {"message": "Заявка отклонена", "request": req.to_dict()}
