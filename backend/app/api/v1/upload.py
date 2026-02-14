import base64
import os
import time
import uuid

from app.utils.decorators import token_required
from flask import Blueprint, current_app, jsonify, request

upload_bp = Blueprint("upload", __name__, url_prefix="/api/v1/upload")

VOICE_EXTENSIONS = {"wav", "mp3", "ogg", "webm", "m4a"}
ATTACHMENT_EXTENSIONS = None
LIMIT_FREE = 20 * 1024 * 1024
LIMIT_PREMIUM = 100 * 1024 * 1024

# Throttle speed for non-premium: ~1.6 MB/s
# 200MB -> 120s => 1.66 MB/s => ~1,747,626 bytes/s
THROTTLE_SPEED_BPS = 1_750_000


def _get_extension(filename: str) -> str | None:
    if not filename or "." not in filename:
        return None
    return filename.rsplit(".", 1)[1].lower()


def _decode_base64(data: str, max_size: int = None) -> bytes:
    if not isinstance(data, str) or not data:
        raise ValueError("Invalid base64 payload")
    if "," in data and data.strip().lower().startswith("data:"):
        data = data.split(",", 1)[1]
    decoded = base64.b64decode(data, validate=True)
    if max_size and len(decoded) > max_size:
        raise ValueError(
            f"File too large. Limit is {max_size // (1024 * 1024)} MB")
    return decoded


def _save_upload(file_bytes: bytes, ext: str, subdir: str) -> str:
    unique_filename = f"{uuid.uuid4()}.{ext}"
    upload_folder = os.path.join(
        current_app.root_path, "static", "uploads", subdir)
    os.makedirs(upload_folder, exist_ok=True)
    file_path = os.path.join(upload_folder, unique_filename)
    with open(file_path, "wb") as f:
        f.write(file_bytes)
    return f"/static/uploads/{subdir}/{unique_filename}"


@upload_bp.route("/voice", methods=["POST"])
@token_required
def upload_voice(current_user):
    """
    Загрузка голосового сообщения
    ...
    """
    try:
        data = request.get_json()
        if not data:
            return jsonify({"message": "No input data provided"}), 400

        file_data = data.get("file")
        filename = data.get("filename")

        if not file_data or not filename:
            return jsonify({"message": "Missing file or filename"}), 400

        ext = _get_extension(filename)
        if ext not in VOICE_EXTENSIONS:
            return jsonify({"message": "Invalid file extension"}), 400

        # Determine limits
        max_size = LIMIT_PREMIUM if current_user.premium else LIMIT_FREE

        try:
            file_bytes = _decode_base64(file_data, max_size)
        except ValueError as e:
            return jsonify({"message": str(e)}), 400

        file_size = len(file_bytes)
        
        # Check disk space limit
        if current_user.disk_usage + file_size > current_user.disk_limit:
             return jsonify({
                 "message": "Disk space limit exceeded. Upgrade to Premium for more space."
             }), 403

        # Simulate slower upload for non-premium users
        if not current_user.premium:
            # Calculate delay: size / speed
            # e.g., 200MB / 1.6MB/s = 120s
            # For 20MB (max free): 20/1.6 = 12.5s
            delay = file_size / THROTTLE_SPEED_BPS
            time.sleep(delay)

        # Create voice directory if not exists
        file_url = _save_upload(file_bytes, ext, "voice")

        # Update user disk usage
        current_user.disk_usage += file_size
        from app.core.extensions import db
        db.session.commit()

        return jsonify({
            "url": file_url,
            "size": file_size,
            "message": "Voice uploaded successfully"
        }), 201

    except Exception as e:
        return jsonify({"message": f"Upload failed: {str(e)}"}), 500


@upload_bp.route("/file", methods=["POST"])
@token_required
def upload_file(current_user):
    """
    Загрузка вложения (файл) через JSON body
    ---\n
    tags:\n
      - Upload\n
    parameters:\n
      - name: body\n
        in: body\n
        required: true\n
        schema:\n
          type: object\n
          properties:\n
            access_token:\n
              type: string\n
              description: Токен доступа\n
            file:\n
              type: string\n
              format: base64\n
              description: Файл в base64 или DataURL (data:*;base64,...)\n
            filename:\n
              type: string\n
              description: Имя файла с расширением\n
    responses:\n
      201:\n
        description: Файл успешно загружен\n
        schema:\n
          type: object\n
          properties:\n
            url:\n
              type: string\n
            original_filename:\n
              type: string\n
            size_bytes:\n
              type: integer\n
            ext:\n
              type: string\n
      400:\n
        description: Ошибка валидации\n
    """
    data = request.get_json()
    if not data:
        return jsonify({"error": "No data provided"}), 400

    file_data = data.get("file")
    filename = data.get("filename")

    if not file_data or not filename:
        return jsonify({"error": "file and filename are required"}), 400

    ext = _get_extension(filename) or "bin"

    # Determine limits
    max_size = LIMIT_PREMIUM if current_user.premium else LIMIT_FREE

    try:
        file_bytes = _decode_base64(file_data, max_size)
        file_size = len(file_bytes)

        # Check disk space limit
        if current_user.disk_usage + file_size > current_user.disk_limit:
             return jsonify({
                 "error": "Disk space limit exceeded. Upgrade to Premium for more space."
             }), 403

        # Simulate slower upload for non-premium users
        if not current_user.premium:
            # Calculate delay: size / speed
            delay = file_size / THROTTLE_SPEED_BPS
            time.sleep(delay)

        file_url = _save_upload(file_bytes, ext, "files")

        # Update user disk usage
        current_user.disk_usage += file_size
        from app.core.extensions import db
        db.session.commit()

        return jsonify({
            "url": file_url,
            "original_filename": filename,
            "size_bytes": file_size,
            "ext": ext
        }), 201
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({"error": f"Failed to process file: {str(e)}"}), 400
