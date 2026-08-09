import io
import os
import uuid
import logging
from flask import Blueprint, jsonify, request
from app.core.extensions import db
from app.utils.decorators import token_required
from app.models.sticker import UserCustomSticker

logger = logging.getLogger(__name__)

stickers_bp = Blueprint("stickers", __name__, url_prefix="/api/v1/stickers")

# Встроенная подборка трендовых стикеров и GIF для чата
FEATURED_STICKERS = [
    {
        "category": "Реакции",
        "items": [
            {"id": "stk_cat_love", "name": "Влюбленный котик", "url": "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExODg1dzR5dDNsbXB3NmI3ZnptOHVqMndtdzFwOHgwdXUzeWZ6ZWs2ciZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9cw/MDJ9IbxxvDUQM/giphy.gif", "type": "sticker"},
            {"id": "stk_doge_wow", "name": "Doge Wow", "url": "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExOHpqa2k0dXNmcnduaDRxdTFxYnRocmxlOWU3Z2FmdDVkbmYxN2EwbiZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9cw/oF5oUYTOhvZOE/giphy.gif", "type": "sticker"},
            {"id": "stk_cat_dance", "name": "Танцующий кот", "url": "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExaWVubW0ydmtidGJxczg5bmtzZmZzaWRhMnRnbXlscHdzajc4cGc2ayZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9cw/CjmvTCZf2U3p09Cn0h/giphy.gif", "type": "sticker"},
            {"id": "stk_thumbs_up", "name": "Класс!", "url": "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExNHlnenBqenF0ZWF1OHMza3ZwbzQ0dzIxa2w5MXp0dnE3M3p2dzRtbSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9cw/111ebonMs90YLu/giphy.gif", "type": "sticker"},
            {"id": "stk_popcorn", "name": "Попкорн", "url": "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExMml2ODV5dnhvbjRjNzFmdm41cGc1eHFmOGI0emNwbWh6eXdtNnloNSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9cw/NipFetnQOuKhW/giphy.gif", "type": "sticker"},
            {"id": "stk_heart_sparkle", "name": "Сердечко", "url": "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExOW11bXVsa2p5eHVwbWRocWpyMjQzYzJ6ZmlmZWVnZjFxdmpubTN1YSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9cw/LpDmM2w9aE9DW/giphy.gif", "type": "sticker"},
        ]
    },
    {
        "category": "Трендовые GIF",
        "items": [
            {"id": "gif_mind_blown", "name": "Mind Blown", "url": "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExbms1ODBsZmxyOGo5czI4ZnhuYmx4cm1iOHJ0aGozNnJsaXUyaWhuaSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/26ufdipQqU2lhNA4g/giphy.gif", "type": "gif"},
            {"id": "gif_cat_typing", "name": "Кот печатает", "url": "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExd2R4OTBxc2I0bzhrNWRrcXFsbHNvaXRxdXZiNDB0MXBwYmludnllZSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/JIX9t2j0ZTN9S/giphy.gif", "type": "gif"},
            {"id": "gif_cheers", "name": "Ди Каприо салют", "url": "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExMWk3amFqODg5dWdrOTdnbmIxeWV0ZjdzdmhxcmFncmY3azFrcnlzaSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/g9582DNuQppxC/giphy.gif", "type": "gif"},
            {"id": "gif_homer_bush", "name": "Гомер в кустах", "url": "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExMGxxc2RxdHhsbGVkZnFzYXFsemlwbWwza3NkdW4waDVidjJydmJucCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/COYGe9rZvfRQc/giphy.gif", "type": "gif"},
            {"id": "gif_rock_eyebrow", "name": "Скалолаз Скала", "url": "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExNm0zb2sxeWpvc2Vybms1ZHdxYXdtcGkyOHY3NGgxaHhsdWpzcTF5NCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/26ghbWoXv3G6ypo8U/giphy.gif", "type": "gif"},
            {"id": "gif_snoopy_dance", "name": "Танец Снупи", "url": "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExM3ZhcGVxZ3AyaG40Nm05NXBsaWs1cWV6b2ZzZ28yaTRtOGlhODU1dCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/134vVkHV9wQtaw/giphy.gif", "type": "gif"},
        ]
    }
]


def _convert_to_webp(file_bytes: bytes, max_size: int = 512) -> bytes:
    """Конвертирует png, jpeg, jpg, webp в оптимизированный WebP кадра 512x512."""
    try:
        from PIL import Image
        img = Image.open(io.BytesIO(file_bytes))
        img.thumbnail((max_size, max_size), Image.Resampling.LANCZOS)
        out = io.BytesIO()
        img.save(out, format="WEBP", quality=90, method=6)
        return out.getvalue()
    except Exception as e:
        logger.warning(f"PIL WebP conversion failed: {e}")
        return file_bytes


def _convert_to_mp4(file_bytes: bytes, original_ext: str) -> bytes:
    """Конвертирует mp4 или gif в сжатый зацикленный MP4 ролик."""
    import subprocess
    import tempfile

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
        res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=20)
        if res.returncode == 0 and os.path.exists(tmp_out_path):
            with open(tmp_out_path, "rb") as f:
                mp4_bytes = f.read()
            try:
                os.remove(tmp_in_path)
                os.remove(tmp_out_path)
            except Exception:
                pass
            return mp4_bytes
    except Exception as e:
        logger.warning(f"ffmpeg MP4 conversion failed: {e}")
    return file_bytes


@stickers_bp.route("", methods=["GET"])
@token_required
def get_stickers(current_user):
    user_stickers = UserCustomSticker.query.filter_by(user_id=current_user.id).order_by(UserCustomSticker.created_at.desc()).all()
    
    my_stickers = [s.to_dict() for s in user_stickers if s.type == "sticker"]
    my_gifs = [s.to_dict() for s in user_stickers if s.type == "gif"]

    categories = []
    if my_stickers:
        categories.append({"category": "Мои стикеры", "items": my_stickers})
    if my_gifs:
        categories.append({"category": "Мои GIF", "items": my_gifs})

    categories.extend(FEATURED_STICKERS)

    return jsonify({
        "success": True,
        "categories": categories
    })


@stickers_bp.route("/upload", methods=["POST"])
@token_required
def upload_custom_sticker(current_user):
    if "file" not in request.files:
        return jsonify({"success": False, "error": "Файл не передан"}), 400

    file_obj = request.files["file"]
    sticker_type = request.form.get("type", "sticker").lower()  # "sticker" или "gif"
    custom_name = request.form.get("name", "").strip()

    filename = file_obj.filename or "file"
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    file_bytes = file_obj.read()

    if not file_bytes:
        return jsonify({"success": False, "error": "Пустой файл"}), 400

    from app.api.v1.upload import _get_s3_client, _get_s3_bucket, _get_s3_public_url

    if sticker_type == "gif":
        # mp4 или gif конвертируются в .mp4
        converted_bytes = _convert_to_mp4(file_bytes, ext)
        final_ext = "mp4"
        content_type = "video/mp4"
    else:
        # png, jpg, jpeg, webp конвертируются в .webp
        converted_bytes = _convert_to_webp(file_bytes)
        final_ext = "webp"
        content_type = "image/webp"

    file_id = str(uuid.uuid4())
    key = f"stickers/{current_user.id}/{file_id}.{final_ext}"

    try:
        s3 = _get_s3_client()
        bucket = _get_s3_bucket()
        s3.put_object(
            Bucket=bucket,
            Key=key,
            Body=converted_bytes,
            ContentType=content_type,
        )
        public_url = f"{_get_s3_public_url()}/uploads/{key}"

        new_item = UserCustomSticker(
            id=file_id,
            user_id=current_user.id,
            url=public_url,
            name=custom_name or ("Мой стикер" if sticker_type == "sticker" else "Мой GIF"),
            type=sticker_type,
        )
        db.session.add(new_item)
        db.session.commit()

        return jsonify({
            "success": True,
            "sticker": new_item.to_dict()
        })
    except Exception as e:
        db.session.rollback()
        logger.error(f"Failed to upload sticker: {e}")
        return jsonify({"success": False, "error": f"Ошибка сохранения: {e}"}), 500


@stickers_bp.route("/<sticker_id>", methods=["DELETE"])
@token_required
def delete_custom_sticker(current_user, sticker_id):
    item = UserCustomSticker.query.filter_by(id=sticker_id, user_id=current_user.id).first()
    if not item:
        return jsonify({"success": False, "error": "Стикер не найден"}), 404

    try:
        db.session.delete(item)
        db.session.commit()
        return jsonify({"success": True})
    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "error": str(e)}), 500
