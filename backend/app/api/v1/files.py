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


@files_router.post("/list")
async def list_user_files_post(
    payload: Optional[Dict[str, Any]] = None,
    current_user=Depends(get_current_user),
    db=Depends(get_async_db)
):
    page = int((payload or {}).get("page", 1) or 1)
    per_page = int((payload or {}).get("per_page", 20) or 20)
    return await list_user_files(page=page, per_page=per_page, current_user=current_user, db=db)


@files_router.delete("")
@files_router.delete("/")
@files_router.delete("/delete")
@files_router.post("/delete")
async def delete_user_file(
    payload: Optional[FileDeleteSchema] = None,
    current_user=Depends(get_current_user),
    db=Depends(get_async_db)
):
    fid = (payload.file_id if payload else None)
    furl = (payload.url if payload else None)
    if not fid and not furl:
        raise HTTPException(status_code=400, detail="file_id or url is required")

    stmt = select(UserFile).where(UserFile.user_id == current_user.id)
    if fid:
        stmt = stmt.where(UserFile.id == fid)
    else:
        stmt = stmt.where(UserFile.url == furl)

    res = await db.execute(stmt)
    user_file = res.scalar_one_or_none()
    if not user_file:
        raise HTTPException(status_code=404, detail="File record not found")

    await db.delete(user_file)
    await db.commit()
    return {"message": "File record deleted"}


@files_router.delete("/{file_id}")
async def delete_user_file_by_id(
    file_id: str,
    current_user=Depends(get_current_user),
    db=Depends(get_async_db)
):
    return await delete_user_file(FileDeleteSchema(file_id=file_id), current_user=current_user, db=db)

