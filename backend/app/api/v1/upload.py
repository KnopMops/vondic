import base64
import binascii
import io
import logging
import os
import time

import requests as http_requests

logger = logging.getLogger(__name__)
from app.utils.decorators import token_required
from flask import Blueprint, current_app, jsonify, request

upload_bp = Blueprint("upload", __name__, url_prefix="/api/v1/upload")

VOICE_EXTENSIONS = {"wav", "mp3", "ogg", "webm", "m4a"}
VIDEO_EXTENSIONS = {"mp4", "mov", "webm", "mkv", "avi"}
ATTACHMENT_EXTENSIONS = None
LIMIT_FREE = 20 * 1024 * 1024
LIMIT_PREMIUM = 100 * 1024 * 1024

THROTTLE_SPEED_BPS = 1_750_000


STATIC_UPLOAD_URL = os.getenv(
    "STATIC_UPLOAD_URL",
    "http://static-nginx:80/api/upload")


def _get_extension(filename: str) -> str | None:
    if not filename or "." not in filename:
        return None
    return filename.rsplit(".", 1)[1].lower()


def _decode_base64(data: str, max_size: int = None) -> bytes:
    if not isinstance(data, str) or not data:
        raise ValueError("Invalid base64 payload")
    if "," in data and data.strip().lower().startswith("data:"):
        data = data.split(",", 1)[1]
    # Strip any whitespace/newlines that React Native may add
    data = data.strip().replace("\n", "").replace("\r", "").replace(" ", "")
    try:
        decoded = base64.b64decode(data, validate=False)
    except (binascii.Error, Exception) as e:
        raise ValueError(f"Invalid base64 data: {e}") from e
    if max_size and len(decoded) > max_size:
        raise ValueError(
            f"File too large. Limit is {max_size // (1024 * 1024)} MB")
    return decoded


def _save_upload(file_bytes: bytes, ext: str, subdir: str) -> str:
    """Upload file to static-nginx upload service."""
    filename = f"file.{ext}"

    try:
        files = {
            "file": (
                filename,
                io.BytesIO(file_bytes),
                "application/octet-stream")}
        data = {"filename": filename}

        resp = http_requests.post(
            f"{STATIC_UPLOAD_URL}/{subdir}",
            files=files,
            data=data,
            timeout=30
        )
        resp.raise_for_status()
        result = resp.json()
        return result["url"]
    except http_requests.exceptions.RequestException as e:
        raise RuntimeError(f"Failed to upload file to static service: {e}")


@upload_bp.route("/voice", methods=["POST"])
@token_required
def upload_voice(current_user):
    from app.core.extensions import db
    from app.models.user_file import UserFile
    try:
        data = request.get_json(silent=True)
        if not data:
            return jsonify({"error": "No input data provided"}), 400

        file_data = data.get("file")
        filename = data.get("filename")

        if not file_data or not filename:
            return jsonify({"error": "Missing file or filename"}), 400

        ext = _get_extension(filename)
        if ext not in VOICE_EXTENSIONS:
            return jsonify({"error": f"Invalid file extension: {ext}. Allowed: {VOICE_EXTENSIONS}"}), 400

        max_size = LIMIT_PREMIUM if current_user.premium else LIMIT_FREE

        try:
            file_bytes = _decode_base64(file_data, max_size)
        except ValueError as e:
            logger.error("[upload_voice] base64 decode error: %s", e)
            return jsonify({"error": str(e)}), 400

        file_size = len(file_bytes)
        logger.info("[upload_voice] user=%s file_size=%d ext=%s", current_user.id, file_size, ext)

        if (current_user.disk_usage or 0) + file_size > current_user.disk_limit:
            return jsonify(
                {
                    "error": "Disk space limit exceeded. Upgrade to Premium for more space."
                }
            ), 403

        if not current_user.premium:
            delay = file_size / THROTTLE_SPEED_BPS
            time.sleep(delay)

        file_url = _save_upload(file_bytes, ext, "voice")

        try:
            db.session.add(
                UserFile(
                    user_id=current_user.id,
                    name=filename,
                    url=file_url,
                    size=file_size,
                )
            )
            db.session.flush()
        except Exception as uf_err:
            logger.warning("[upload_voice] UserFile insert failed (ignored): %s", uf_err)

        current_user.disk_usage = (current_user.disk_usage or 0) + file_size
        db.session.commit()

        return jsonify(
            {
                "url": file_url,
                "size": file_size,
                "message": "Voice uploaded successfully",
            }
        ), 201

    except Exception as e:
        logger.exception("[upload_voice] Unexpected error: %s", e)
        return jsonify({"error": f"Upload failed: {str(e)}"}), 500


@upload_bp.route("/file", methods=["POST"])
@token_required
def upload_file(current_user):
    data = request.get_json()
    if not data:
        return jsonify({"error": "No data provided"}), 400

    file_data = data.get("file")
    filename = data.get("filename")

    if not file_data or not filename:
        return jsonify({"error": "file and filename are required"}), 400

    ext = _get_extension(filename) or "bin"

    max_size = LIMIT_PREMIUM if current_user.premium else LIMIT_FREE

    try:
        file_bytes = _decode_base64(file_data, max_size)
        file_size = len(file_bytes)

        if current_user.disk_usage + file_size > current_user.disk_limit:
            return jsonify(
                {
                    "error": "Disk space limit exceeded. Upgrade to Premium for more space."
                }
            ), 403

        if not current_user.premium:
            delay = file_size / THROTTLE_SPEED_BPS
            time.sleep(delay)

        file_url = _save_upload(file_bytes, ext, "files")

        try:
            from app.core.extensions import db
            from app.models.user_file import UserFile

            db.session.add(
                UserFile(
                    user_id=current_user.id,
                    name=filename,
                    url=file_url,
                    size=file_size,
                )
            )
            db.session.flush()
        except Exception:

            pass

        current_user.disk_usage += file_size
        db.session.commit()

        return jsonify(
            {
                "url": file_url,
                "original_filename": filename,
                "size_bytes": file_size,
                "ext": ext,
            }
        ), 201
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({"error": f"Failed to process file: {str(e)}"}), 400


@upload_bp.route("/video", methods=["POST"])
@token_required
def upload_video(current_user):
    from app.core.extensions import db
    from app.models.user_file import UserFile
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "No data provided"}), 400

    file_data = data.get("file")
    filename = data.get("filename")

    if not file_data or not filename:
        return jsonify({"error": "file and filename are required"}), 400

    ext = _get_extension(filename)
    if not ext or ext.lower() not in VIDEO_EXTENSIONS:
        return jsonify({"error": f"Invalid video extension: {ext}. Allowed: {VIDEO_EXTENSIONS}"}), 400

    try:
        file_bytes = _decode_base64(file_data, LIMIT_PREMIUM if current_user.premium else LIMIT_FREE)
        file_size = len(file_bytes)
        logger.info("[upload_video] user=%s file_size=%d ext=%s", current_user.id, file_size, ext)

        if not current_user.premium:
            delay = file_size / THROTTLE_SPEED_BPS
            time.sleep(delay)

        file_url = _save_upload(file_bytes, ext, "video")

        try:
            db.session.add(
                UserFile(
                    user_id=current_user.id,
                    name=filename,
                    url=file_url,
                    size=file_size,
                )
            )
            db.session.flush()
        except Exception as uf_err:
            logger.warning("[upload_video] UserFile insert failed (ignored): %s", uf_err)

        current_user.disk_usage = (current_user.disk_usage or 0) + file_size
        db.session.commit()

        return jsonify(
            {
                "url": file_url,
                "original_filename": filename,
                "size_bytes": file_size,
                "ext": ext,
            }
        ), 201
    except ValueError as e:
        logger.error("[upload_video] ValueError: %s", e)
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        logger.exception("[upload_video] Unexpected error: %s", e)
        return jsonify({"error": f"Failed to upload video: {str(e)}"}), 400
