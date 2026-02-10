import base64
import os
import uuid

from app.utils.decorators import token_required
from flask import Blueprint, current_app, jsonify, request

upload_bp = Blueprint("upload", __name__, url_prefix="/api/v1/upload")

VOICE_EXTENSIONS = {"wav", "mp3", "ogg", "webm", "m4a"}
ATTACHMENT_EXTENSIONS = {
    "wav",
    "mp3",
    "ogg",
    "webm",
    "m4a",
    "png",
    "jpg",
    "jpeg",
    "gif",
    "webp",
    "mp4",
    "mov",
    "pdf",
    "txt",
    "zip",
}
MAX_UPLOAD_BYTES = 20 * 1024 * 1024


def _get_extension(filename: str) -> str | None:
    if not filename or "." not in filename:
        return None
    return filename.rsplit(".", 1)[1].lower()


def _decode_base64(data: str) -> bytes:
    if not isinstance(data, str) or not data:
        raise ValueError("Invalid base64 payload")
    if "," in data and data.strip().lower().startswith("data:"):
        data = data.split(",", 1)[1]
    decoded = base64.b64decode(data, validate=True)
    if len(decoded) > MAX_UPLOAD_BYTES:
        raise ValueError("File too large")
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
    ---\n
    tags:\n
      - Upload\n
    parameters:\n
      - name: body\n
        in: body\n        required: true\n        schema:\n

          type: object\n

          properties:\n

            access_token:\n

              type: string\n

              description: Токен доступа\n

            file:\n

              type: string\n

              format: base64\n

              description: Аудио файл в формате base64 (wav, mp3, ogg, webm)\n

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

      400:\n

        description: Ошибка валидации\n

    """
    data = request.get_json()
    if not data:
        return jsonify({"error": "No data provided"}), 400

    file_data = data.get('file')
    filename = data.get('filename')

    if not file_data or not filename:
        return jsonify({"error": "file and filename are required"}), 400

    ext = _get_extension(filename)
    if not ext or ext not in VOICE_EXTENSIONS:
        return jsonify({"error": "File type not allowed"}), 400

    try:
        file_bytes = _decode_base64(file_data)
        file_url = _save_upload(file_bytes, ext, "voice")
        return jsonify({"url": file_url}), 201

    except Exception as e:
        return jsonify({"error": f"Failed to process file: {str(e)}"}), 400


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

    ext = _get_extension(filename)
    if not ext or ext not in ATTACHMENT_EXTENSIONS:
        return jsonify({"error": "File type not allowed"}), 400

    try:
        file_bytes = _decode_base64(file_data)
        file_url = _save_upload(file_bytes, ext, "attachments")
        return (
            jsonify(
                {
                    "url": file_url,
                    "original_filename": filename,
                    "size_bytes": len(file_bytes),
                    "ext": ext,
                }
            ),
            201,
        )
    except Exception as e:
        return jsonify({"error": f"Failed to process file: {str(e)}"}), 400
