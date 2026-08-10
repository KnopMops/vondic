from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel

from app.core.deps import get_current_user
from app.services.mail_api_service import get_mail_api_permissions, set_mail_api_permissions
from app.services.mailbox_service import MailboxService

mail_router = APIRouter(prefix="/api/v1/mail", tags=["Mail"])


class MailboxCreateSchema(BaseModel):
    local_part: Optional[str] = None
    username: Optional[str] = None
    password: str
    display_name: Optional[str] = None
    quota_mb: Optional[int] = 1024


class MailSendSchema(BaseModel):
    to_address: str
    subject: str
    body: str
    is_html: Optional[bool] = False


@mail_router.get("/mailbox/suggest")
async def suggest_mailbox_local_part(current_user=Depends(get_current_user)):
    return {"local_part": MailboxService.suggest_local_part(current_user)}


@mail_router.get("/mailbox")
async def get_mailbox(current_user=Depends(get_current_user)):
    box = MailboxService.get_for_user(current_user.id)
    if not box:
        return {"mailbox": None}
    return {"mailbox": MailboxService.mailbox_to_dict(box)}


@mail_router.post("/mailbox", status_code=status.HTTP_201_CREATED)
async def create_mailbox(
    payload: MailboxCreateSchema,
    current_user=Depends(get_current_user)
):
    local = payload.local_part or payload.username or ""
    box, error, coins_awarded = MailboxService.create_mailbox(
        current_user,
        local_part=local,
        password=payload.password,
        display_name=payload.display_name,
        quota_mb=payload.quota_mb or 1024,
    )
    if error or not box:
        raise HTTPException(status_code=400, detail=error or "Failed to create mailbox")
    return {
        "mailbox": MailboxService.mailbox_to_dict(box),
        "coins_awarded": coins_awarded,
        "balance": int(current_user.balance or 0),
    }


@mail_router.get("/folders")
async def get_folders(current_user=Depends(get_current_user)):
    return {
        "folders": [
            {"id": "INBOX", "name": "Входящие", "unread": 0},
            {"id": "SENT", "name": "Отправленные", "unread": 0},
            {"id": "TRASH", "name": "Корзина", "unread": 0},
            {"id": "SPAM", "name": "Спам", "unread": 0},
        ]
    }


@mail_router.get("/messages")
async def fetch_messages(
    folder: str = Query("INBOX"),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_user=Depends(get_current_user)
):
    try:
        messages, total, err = MailboxService.fetch_messages(
            current_user.id, folder=folder, limit=limit, offset=offset
        )
        if err:
            return {"messages": [], "total": 0}
        return {"messages": messages, "total": total}
    except Exception:
        return {"messages": [], "total": 0}



@mail_router.post("/send")
async def send_mail(
    payload: MailSendSchema,
    current_user=Depends(get_current_user)
):
    success, err = MailboxService.send_message(
        current_user.id,
        to_address=payload.to_address,
        subject=payload.subject,
        body=payload.body,
        is_html=payload.is_html or False
    )
    if not success:
        raise HTTPException(status_code=400, detail=err or "Failed to send email")
    return {"success": True, "message": "Email sent"}
