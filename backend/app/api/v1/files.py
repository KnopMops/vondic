import math
import os
from typing import Optional, List, Dict, Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import select, func

from app.core.database import get_async_db
from app.core.deps import get_current_user
from app.models.user_file import UserFile

files_router = APIRouter(prefix="/api/v1/files", tags=["Files"])


class FileDeleteSchema(BaseModel):
    file_id: Optional[str] = None
    url: Optional[str] = None


@files_router.get("")
@files_router.get("/")
async def list_user_files(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    current_user=Depends(get_current_user),
    db=Depends(get_async_db)
):
    offset = (page - 1) * per_page
    res_count = await db.execute(
        select(func.count(UserFile.id)).where(UserFile.user_id == current_user.id)
    )
    total = res_count.scalar_one() or 0

    res = await db.execute(
        select(UserFile)
        .where(UserFile.user_id == current_user.id)
        .order_by(UserFile.created_at.desc())
        .offset(offset)
        .limit(per_page)
    )
    files = res.scalars().all()

    return {
        "files": [{"id": f.id, "filename": f.filename, "url": f.url, "size": f.size, "mime_type": f.mime_type, "storage_type": f.storage_type} for f in files],
        "total": total,
        "page": page,
        "pages": math.ceil(total / per_page) if per_page else 1,
    }


@files_router.delete("")
@files_router.delete("/")
async def delete_user_file(
    payload: FileDeleteSchema,
    current_user=Depends(get_current_user),
    db=Depends(get_async_db)
):
    if not payload.file_id and not payload.url:
        raise HTTPException(status_code=400, detail="file_id or url is required")

    stmt = select(UserFile).where(UserFile.user_id == current_user.id)
    if payload.file_id:
        stmt = stmt.where(UserFile.id == payload.file_id)
    else:
        stmt = stmt.where(UserFile.url == payload.url)

    res = await db.execute(stmt)
    user_file = res.scalar_one_or_none()
    if not user_file:
        raise HTTPException(status_code=404, detail="File record not found")

    await db.delete(user_file)
    await db.commit()
    return {"message": "File record deleted"}
