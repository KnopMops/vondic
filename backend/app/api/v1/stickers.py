import asyncio
import io
import logging
import os
import tempfile
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_async_session
from app.core.deps import get_current_user
from app.models.sticker import UserCustomSticker
from app.models.user import User
from app.services.s3_service import upload_file_to_s3

logger = logging.getLogger(__name__)

stickers_router = APIRouter(prefix="/api/v1/stickers", tags=["Stickers"])

FEATURED_STICKERS = [
    {
        "category": "Реакции",
        "items": [
            {"id": "stk_cat_love", "name": "Влюбленный котик",
                "url": "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExODg1dzR5dDNsbXB3NmI3ZnptOHVqMndtdzFwOHgwdXUzeWZ6ZWs2ciZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9cw/MDJ9IbxxvDUQM/giphy.gif", "type": "sticker"},
            {"id": "stk_doge_wow", "name": "Doge Wow", "url": "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExOHpqa2k0dXNmcnduaDRxdTFxYnRocmxlOWU3Z2FmdDVkbmYxN2EwbiZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9cw/oF5oUYTOhvZOE/giphy.gif", "type": "sticker"},
            {"id": "stk_cat_dance", "name": "Танцующий кот",
                "url": "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExaWVubW0ydmtidGJxczg5bmtzZmZzaWRhMnRnbXlscHdzajc4cGc2ayZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9cw/CjmvTCZf2U3p09Cn0h/giphy.gif", "type": "sticker"},
            {"id": "stk_thumbs_up", "name": "Класс!", "url": "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExNHlnenBqenF0ZWF1OHMza3ZwbzQ0dzIxa2w5MXp0dnE3M3p2dzRtbSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9cw/111ebonMs90YLu/giphy.gif", "type": "sticker"},
            {"id": "stk_popcorn", "name": "Попкорн", "url": "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExMml2ODV5dnhvbjRjNzFmdm41cGc1eHFmOGI0emNwbWh6eXdtNnloNSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9cw/NipFetnQOuKhW/giphy.gif", "type": "sticker"},
            {"id": "stk_heart_sparkle", "name": "Сердечко",
                "url": "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExOW11bXVsa2p5eHVwbWRocWpyMjQzYzJ6ZmlmZWVnZjFxdmpubTN1YSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9cw/LpDmM2w9aE9DW/giphy.gif", "type": "sticker"},
        ]
    },
    {
        "category": "Трендовые GIF",
        "items": [
            {"id": "gif_mind_blown", "name": "Mind Blown",
                "url": "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExbms1ODBsZmxyOGo5czI4ZnhuYmx4cm1iOHJ0aGozNnJsaXUyaWhuaSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/26ufdipQqU2lhNA4g/giphy.gif", "type": "gif"},
            {"id": "gif_cat_typing", "name": "Кот печатает",
                "url": "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExd2R4OTBxc2I0bzhrNWRrcXFsbHNvaXRxdXZiNDB0MXBwYmludnllZSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/JIX9t2j0ZTN9S/giphy.gif", "type": "gif"},
            {"id": "gif_cheers", "name": "Ди Каприо салют",
                "url": "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExMWk3amFqODg5dWdrOTdnbmIxeWV0ZjdzdmhxcmFncmY3azFrcnlzaSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/g9582DNuQppxC/giphy.gif", "type": "gif"},
            {"id": "gif_homer_bush", "name": "Гомер в кустах",
                "url": "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExMGxxc2RxdHhsbGVkZnFzYXFsemlwbWwza3NkdW4waDVidjJydmJucCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/COYGe9rZvfRQc/giphy.gif", "type": "gif"},
            {"id": "gif_rock_eyebrow", "name": "Скалолаз Скала",
                "url": "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExNm0zb2sxeWpvc2Vybms1ZHdxYXdtcGkyOHY3NGgxaHhsdWpzcTF5NCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/26ghbWoXv3G6ypo8U/giphy.gif", "type": "gif"},
            {"id": "gif_snoopy_dance", "name": "Танец Снупи",
                "url": "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExM3ZhcGVxZ3AyaG40Nm05NXBsaWs1cWV6b2ZzZ28yaTRtOGlhODU1dCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/134vVkHV9wQtaw/giphy.gif", "type": "gif"},
        ]
    }
]


def _convert_to_webp(file_bytes: bytes, max_size: int = 512) -> bytes:
    """Конвертирует png, jpeg, jpg, webp в оптимизированный прозрачный WebP (512x512)."""
    try:
        from PIL import Image
        img = Image.open(io.BytesIO(file_bytes))
        img.thumbnail((max_size, max_size), Image.Resampling.LANCZOS)
        out = io.BytesIO()
        img.save(out, format="WEBP", quality=90, method=6)
        return out.getvalue()
    except Exception as e:
        logger.warning(f"Pillow WebP conversion failed: {e}")
        return file_bytes


async def _convert_to_mp4_async(file_bytes: bytes, original_ext: str) -> bytes:
    """Конвертирует mp4 или gif в сжатый зацикленный MP4 ролик."""
    ext = (original_ext or "gif").lower()
    if ext not in ["gif", "mp4", "mov", "webm"]:
        ext = "gif"

    try:
        with tempfile.NamedTemporaryFile(suffix=f".{ext}", delete=False) as tmp_in:
            tmp_in.write(file_bytes)
            tmp_in_path = tmp_in.name

        tmp_out_path = tmp_in_path + ".mp4"
        cmd = [
            "ffmpeg", "-y", "-i", tmp_in_path,
            "-an",
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
            await asyncio.wait_for(proc.communicate(), timeout=20.0)
            if proc.returncode == 0 and os.path.exists(tmp_out_path):
                with open(tmp_out_path, "rb") as f:
                    return f.read()
        finally:
            for p in (tmp_in_path, tmp_out_path):
                if os.path.exists(p):
                    try:
                        os.remove(p)
                    except Exception:
                        pass
    except Exception as e:
        logger.warning(f"Async ffmpeg MP4 conversion failed: {e}")
    return file_bytes


@stickers_router.get("")
async def get_stickers(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session),
):
    stmt = select(UserCustomSticker).where(UserCustomSticker.user_id ==
                                           current_user.id).order_by(UserCustomSticker.created_at.desc())
    res = await db.execute(stmt)
    user_stickers = res.scalars().all()

    my_stickers = [s.to_dict() for s in user_stickers if s.type == "sticker"]
    my_gifs = [s.to_dict() for s in user_stickers if s.type == "gif"]

    categories = []
    if my_stickers:
        categories.append({"category": "Мои стикеры", "items": my_stickers})
    if my_gifs:
        categories.append({"category": "Мои GIF", "items": my_gifs})

    categories.extend(FEATURED_STICKERS)

    return {
        "success": True,
        "categories": categories,
    }


@stickers_router.post("/upload")
async def upload_custom_sticker(
    file: UploadFile = File(...),
    type: str = Form("sticker"),
    name: str = Form(""),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session),
):
    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(status_code=400, detail="Пустой файл")

    filename = file.filename or "file"
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    sticker_type = type.lower()
    custom_name = name.strip()

    if sticker_type == "gif":
        converted_bytes = await _convert_to_mp4_async(file_bytes, ext)
        final_ext = "mp4"
        content_type = "video/mp4"
    else:
        converted_bytes = _convert_to_webp(file_bytes)
        final_ext = "webp"
        content_type = "image/webp"

    file_id = str(uuid.uuid4())
    key = f"stickers/{current_user.id}/{file_id}.{final_ext}"

    try:
        public_url = await upload_file_to_s3(converted_bytes, key, content_type=content_type)
        new_item = UserCustomSticker(
            id=file_id,
            user_id=current_user.id,
            url=public_url,
            name=custom_name or ("Мой стикер" if sticker_type == "sticker" else "Мой GIF"),
            type=sticker_type,
        )
        db.add(new_item)
        await db.commit()

        return {
            "success": True,
            "sticker": new_item.to_dict(),
        }
    except Exception as e:
        await db.rollback()
        logger.error(f"Failed to upload sticker: {e}")
        raise HTTPException(status_code=500, detail=f"Ошибка сохранения: {e}")


@stickers_router.delete("/{sticker_id}")
async def delete_custom_sticker(
    sticker_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session),
):
    stmt = select(UserCustomSticker).where(
        UserCustomSticker.id == sticker_id,
        UserCustomSticker.user_id == current_user.id,
    )
    res = await db.execute(stmt)
    item = res.scalars().first()

    if not item:
        raise HTTPException(status_code=404, detail="Стикер не найден")

    try:
        await db.delete(item)
        await db.commit()
        return {"success": True}
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
