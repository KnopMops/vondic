from typing import Optional, Dict, Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.core.deps import get_current_user, get_current_admin_user
from app.services.app_download_service import AppDownloadService

app_downloads_router = APIRouter(prefix="/api/v1/app-downloads", tags=["App Downloads"])


class AppDownloadsUpdateSchema(BaseModel):
    downloads: Optional[Dict[str, Any]] = None


@app_downloads_router.get("")
@app_downloads_router.get("/")
async def get_app_downloads():
    return {"downloads": AppDownloadService.get_downloads()}


@app_downloads_router.get("/admin")
async def get_app_downloads_admin(admin_user=Depends(get_current_admin_user)):
    return {"downloads": AppDownloadService.get_downloads()}


@app_downloads_router.put("/admin")
async def update_app_downloads_admin(
    payload: AppDownloadsUpdateSchema,
    admin_user=Depends(get_current_admin_user)
):
    patch = payload.downloads or payload.model_dump(exclude_unset=True)
    try:
        merged = AppDownloadService.update_downloads(patch)
        return {"downloads": merged}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
