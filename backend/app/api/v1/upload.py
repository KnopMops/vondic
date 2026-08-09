import asyncio
import base64
import binascii
import io
import logging
import os
import tempfile
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_async_session
from app.core.deps import get_current_user
from app.models.user import User
from app.models.user_file import UserFile
from app.services.s3_service import upload_file_to_s3

logger = logging.getLogger(__name__)

upload_router = APIRouter(prefix="/api/v1/upload", tags=["Upload"])

VOICE_EXTENSIONS = {"wav", "mp3", "ogg", "webm", "m4a"}
VIDEO_EXTENSIONS = {"mp4", "mov", "webm", "mkv", "avi"}
LIMIT_FREE = 20 * 1024 * 1024
LIMIT_PREMIUM = 100 * 1024 * 1024


def _get_extension(filename: str) -> Optional[str]:
    if not filename or "." not in filename:
        return None
    return filename.rsplit(".", 1)[1].lower()


def _decode_base64(data: str, max_size: Optional[int] = None) -> bytes:
    if not isinstance(data, str) or not data:
        raise ValueError("Invalid base64 payload")
    if "," in data and data.strip().lower().startswith("data:"):
        data = data.split(",", 1)[1]
    data = data.strip().replace("\n", "").replace("\r", "").replace(" ", "")
    try:
        decoded = base64.b64decode(data, validate=False)
    except (binascii.Error, Exception) as e:
        raise ValueError(f"Invalid base64 data: {e}") from e
    if max_size and len(decoded) > max_size:
        raise ValueError(f"File too large. Limit is {max_size // (1024 * 1024)} MB")
    return decoded


async def _convert_gif_to_mp4_async(gif_bytes: bytes) -> tuple[bytes, str]:
    """Асинхронно конвертирует GIF в зацикленный MP4 ролик через ffmpeg (asyncio.create_subprocess_exec)."""
    try:
        with tempfile.NamedTemporaryFile(suffix=".gif", delete=False) as tmp_in:
            tmp_in.write(gif_bytes)
            tmp_in_path = tmp_in.name

        tmp_out_path = tmp_in_path + ".mp4"

        cmd = [
            "ffmpeg", "-y", "-i", tmp_in_path,
            "-movflags", "faststart",
            "-pix_fmt", "yuv420p",
            "-vf", "scale=trunc(iw/2)*2:trunc(ih/2)*2",
            tmp_out_path
        ]
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        try:
            await asyncio.wait_for(proc.communicate(), timeout=15.0)
            if proc.returncode == 0 and os.path.exists(tmp_out_path):
                with open(tmp_out_path, "rb") as f:
                    mp4_bytes = f.read()
                return mp4_bytes, "mp4"
        finally:
            for p in (tmp_in_path, tmp_out_path):
                if os.path.exists(p):
                    try:
                        os.remove(p)
                    except Exception:
                        pass
    except Exception as e:
        logger.warning(f"Async GIF to MP4 conversion fallback: {e}")
    return gif_bytes, "gif"


async def _save_upload_async(file_bytes: bytes, ext: str, subdir: str, user: User) -> str:
    ext = (ext or "").lower()
    if ext == "gif":
        file_bytes, ext = await _convert_gif_to_mp4_async(file_bytes)

    content_type_map = {
        "mp4": "video/mp4",
        "gif": "image/gif",
        "webp": "image/webp",
        "png": "image/png",
        "jpg": "image/jpeg",
        "jpeg": "image/jpeg",
        "ogg": "audio/ogg",
        "mp3": "audio/mpeg",
    }
    content_type = content_type_map.get(ext, "application/octet-stream")
    filename = f"{uuid.uuid4()}.{ext}"
    key = f"{subdir}/{filename}"

    return await upload_file_to_s3(file_bytes, key, content_type=content_type)


@upload_router.post("/voice", status_code=status.HTTP_201_CREATED)
async def upload_voice(
    request: Request,
    file: Optional[UploadFile] = File(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session),
):
    filename: Optional[str] = None
    file_bytes: Optional[bytes] = None

    if file:
        filename = file.filename
        file_bytes = await file.read()
    else:
        try:
            data = await request.json()
            if data and data.get("file") and data.get("filename"):
                filename = data["filename"]
                max_size = LIMIT_PREMIUM if current_user.premium else LIMIT_FREE
                file_bytes = _decode_base64(data["file"], max_size)
        except Exception:
            pass

    if not file_bytes or not filename:
        raise HTTPException(status_code=400, detail="Missing file or filename")

    ext = _get_extension(filename)
    if not ext or ext not in VOICE_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file extension: {ext}. Allowed: {VOICE_EXTENSIONS}",
        )

    file_size = len(file_bytes)
    if (current_user.disk_usage or 0) + file_size > current_user.disk_limit:
        raise HTTPException(
            status_code=403,
            detail="Disk space limit exceeded. Upgrade to Premium for more space.",
        )

    file_url = await _save_upload_async(file_bytes, ext, "voice", current_user)

    try:
        user_file = UserFile(
            user_id=current_user.id,
            name=filename,
            url=file_url,
            size=file_size,
        )
        db.add(user_file)
        current_user.disk_usage = (current_user.disk_usage or 0) + file_size
        await db.commit()
    except Exception as e:
        logger.warning(f"Failed to record UserFile: {e}")
        await db.rollback()

    return {
        "url": file_url,
        "size": file_size,
        "disk_usage": current_user.disk_usage or 0,
        "storage": "s3",
        "message": "Voice uploaded successfully",
    }


@upload_router.post("/file", status_code=status.HTTP_201_CREATED)
async def upload_file(
    request: Request,
    file: Optional[UploadFile] = File(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session),
):
    filename: Optional[str] = None
    file_bytes: Optional[bytes] = None

    if file:
        filename = file.filename
        file_bytes = await file.read()
    else:
        try:
            data = await request.json()
            if data and data.get("file") and data.get("filename"):
                filename = data["filename"]
                max_size = LIMIT_PREMIUM if current_user.premium else LIMIT_FREE
                file_bytes = _decode_base64(data["file"], max_size)
        except Exception:
            pass

    if not file_bytes or not filename:
        raise HTTPException(status_code=400, detail="file and filename are required")

    ext = _get_extension(filename) or "bin"
    file_size = len(file_bytes)

    if (current_user.disk_usage or 0) + file_size > current_user.disk_limit:
        raise HTTPException(
            status_code=403,
            detail="Disk space limit exceeded. Upgrade to Premium for more space.",
        )

    file_url = await _save_upload_async(file_bytes, ext, "files", current_user)

    try:
        user_file = UserFile(
            user_id=current_user.id,
            name=filename,
            url=file_url,
            size=file_size,
        )
        db.add(user_file)
        current_user.disk_usage = (current_user.disk_usage or 0) + file_size
        await db.commit()
    except Exception as e:
        logger.warning(f"Failed to save UserFile: {e}")
        await db.rollback()

    return {
        "url": file_url,
        "original_filename": filename,
        "size_bytes": file_size,
        "disk_usage": current_user.disk_usage or 0,
        "storage": "s3",
        "ext": ext,
    }


@upload_router.post("/video", status_code=status.HTTP_201_CREATED)
async def upload_video(
    request: Request,
    file: Optional[UploadFile] = File(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session),
):
    filename: Optional[str] = None
    file_bytes: Optional[bytes] = None

    if file:
        filename = file.filename
        file_bytes = await file.read()
    else:
        try:
            data = await request.json()
            if data and data.get("file") and data.get("filename"):
                filename = data["filename"]
                max_size = LIMIT_PREMIUM if current_user.premium else LIMIT_FREE
                file_bytes = _decode_base64(data["file"], max_size)
        except Exception:
            pass

    if not file_bytes or not filename:
        raise HTTPException(status_code=400, detail="file and filename are required")

    ext = _get_extension(filename)
    if not ext or ext.lower() not in VIDEO_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid video extension: {ext}. Allowed: {VIDEO_EXTENSIONS}",
        )

    file_size = len(file_bytes)
    if (current_user.disk_usage or 0) + file_size > current_user.disk_limit:
        raise HTTPException(
            status_code=403,
            detail="Disk space limit exceeded. Upgrade to Premium for more space.",
        )

    file_url = await _save_upload_async(file_bytes, ext, "video", current_user)

    try:
        user_file = UserFile(
            user_id=current_user.id,
            name=filename,
            url=file_url,
            size=file_size,
        )
        db.add(user_file)
        current_user.disk_usage = (current_user.disk_usage or 0) + file_size
        await db.commit()
    except Exception as e:
        logger.warning(f"Failed to record UserFile: {e}")
        await db.rollback()

    return {
        "url": file_url,
        "original_filename": filename,
        "size_bytes": file_size,
        "disk_usage": current_user.disk_usage or 0,
        "storage": "s3",
        "ext": ext,
    }

