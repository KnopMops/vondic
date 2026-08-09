import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select, func

from app.core.database import get_async_db
from app.core.deps import get_current_user
from app.models.chat_folder import ChatFolder, ChatFolderItem

chat_folders_router = APIRouter(prefix="/api/v1/chat-folders", tags=["Chat Folders"])


class ChatFolderCreateSchema(BaseModel):
    name: str
    icon: Optional[str] = "📁"


class ChatFolderUpdateSchema(BaseModel):
    name: Optional[str] = None
    icon: Optional[str] = None
    position: Optional[int] = None


class ChatFolderItemSchema(BaseModel):
    type: str
    chat_id: str


@chat_folders_router.get("")
@chat_folders_router.get("/")
async def list_folders(
    current_user=Depends(get_current_user),
    db=Depends(get_async_db)
):
    res = await db.execute(
        select(ChatFolder)
        .where(ChatFolder.user_id == str(current_user.id))
        .order_by(ChatFolder.position.asc())
    )
    folders = res.scalars().all()
    return [f.to_dict() for f in folders]


@chat_folders_router.post("", status_code=status.HTTP_201_CREATED)
@chat_folders_router.post("/", status_code=status.HTTP_201_CREATED)
async def create_folder(
    payload: ChatFolderCreateSchema,
    current_user=Depends(get_current_user),
    db=Depends(get_async_db)
):
    name = payload.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="name required")

    res_max = await db.execute(
        select(func.max(ChatFolder.position)).where(ChatFolder.user_id == str(current_user.id))
    )
    max_pos = res_max.scalar_one() or 0

    folder = ChatFolder(
        id=uuid.uuid4().hex[:12],
        user_id=str(current_user.id),
        name=name,
        icon=payload.icon or "📁",
        position=max_pos + 1,
    )
    db.add(folder)
    await db.commit()
    return folder.to_dict()


@chat_folders_router.put("/{folder_id}")
async def update_folder(
    folder_id: str,
    payload: ChatFolderUpdateSchema,
    current_user=Depends(get_current_user),
    db=Depends(get_async_db)
):
    res = await db.execute(
        select(ChatFolder).where(ChatFolder.id == folder_id, ChatFolder.user_id == str(current_user.id))
    )
    folder = res.scalar_one_or_none()
    if not folder:
        raise HTTPException(status_code=404, detail="Folder not found")

    data = payload.model_dump(exclude_unset=True)
    for field, val in data.items():
        if hasattr(folder, field):
            setattr(folder, field, val)

    await db.commit()
    return folder.to_dict()


@chat_folders_router.delete("/{folder_id}")
async def delete_folder(
    folder_id: str,
    current_user=Depends(get_current_user),
    db=Depends(get_async_db)
):
    res = await db.execute(
        select(ChatFolder).where(ChatFolder.id == folder_id, ChatFolder.user_id == str(current_user.id))
    )
    folder = res.scalar_one_or_none()
    if not folder:
        raise HTTPException(status_code=404, detail="Folder not found")

    await db.delete(folder)
    await db.commit()
    return {"ok": True}


@chat_folders_router.post("/{folder_id}/items", status_code=status.HTTP_201_CREATED)
async def add_item(
    folder_id: str,
    payload: ChatFolderItemSchema,
    current_user=Depends(get_current_user),
    db=Depends(get_async_db)
):
    if payload.type not in ("dm", "group", "channel"):
        raise HTTPException(status_code=400, detail="type must be dm/group/channel")

    item = ChatFolderItem(folder_id=folder_id, chat_type=payload.type, chat_id=str(payload.chat_id))
    db.add(item)
    await db.commit()
    return {"ok": True}
