import math
import os

import boto3
from botocore.config import Config

from app.utils.decorators import token_required
from flask import Blueprint, jsonify, request

from app.core.extensions import db
from app.models.user_file import UserFile

files_bp = Blueprint("files", __name__, url_prefix="/api/v1/files")


def _get_s3_client():
    return boto3.client(
        "s3",
        endpoint_url=os.getenv("S3_ENDPOINT", "http://minio:9000"),
        aws_access_key_id=os.getenv("S3_ACCESS_KEY", "vondic"),
        aws_secret_access_key=os.getenv("S3_SECRET_KEY", "Dim4566212Len"),
        region_name=os.getenv("S3_REGION", "us-east-1"),
        config=Config(signature_version="s3v4"),
    )


def _get_s3_bucket():
    return os.getenv("S3_BUCKET", "uploads")


def _extract_s3_key(url: str) -> str | None:
    public_url = os.getenv("S3_PUBLIC_URL", "https://s3.vondic.ru")
    prefix = f"{public_url}/uploads/"
    if url.startswith(prefix):
        return url[len(prefix):]
    if url.startswith("/uploads/"):
        return url[len("/uploads/"):]
    return None


def _delete_from_s3(url: str) -> bool:
    key = _extract_s3_key(url)
    if not key:
        return False
    try:
        s3 = _get_s3_client()
        s3.delete_object(Bucket=_get_s3_bucket(), Key=key)
        return True
    except Exception:
        return False


def _delete_from_ydisk(url: str, user=None) -> bool:
    if not user or not user.yandex_token:
        return False
    from app.services.yandex_disk_service import YandexDiskService
    ydisk = YandexDiskService(user.yandex_token)
    ydisk_prefix = f"{os.getenv('S3_PUBLIC_URL', 'https://s3.vondic.ru')}/uploads/"
    if url.startswith(ydisk_prefix):
        key = url[len(ydisk_prefix):]
        return ydisk.delete_file(key)
    return False


def _s3_file_exists(url: str) -> bool:
    key = _extract_s3_key(url)
    if not key:
        return False
    try:
        s3 = _get_s3_client()
        s3.head_object(Bucket=_get_s3_bucket(), Key=key)
        return True
    except Exception:
        return False


def _ydisk_file_exists(url: str, user=None) -> bool:
    if not user or not user.yandex_token:
        return False
    from app.services.yandex_disk_service import YandexDiskService
    ydisk = YandexDiskService(user.yandex_token)
    ydisk_prefix = f"{os.getenv('S3_PUBLIC_URL', 'https://s3.vondic.ru')}/uploads/"
    if url.startswith(ydisk_prefix):
        key = url[len(ydisk_prefix):]
        info = ydisk.get_file_info(key)
        return info is not None
    return False


@files_bp.route("/list", methods=["POST"])
@token_required
def list_files(current_user):
    data = request.get_json(silent=True) or {}
    page = int(data.get("page") or 1)
    per_page = int(data.get("per_page") or 20)

    if page < 1:
        page = 1
    if per_page < 1:
        per_page = 20
    if per_page > 100:
        per_page = 100

    q = UserFile.query.filter_by(
        user_id=current_user.id).order_by(
        UserFile.created_at.desc())

    all_files = q.all()
    cleaned = False
    for f in all_files:
        exists = _s3_file_exists(f.url) or _ydisk_file_exists(f.url, current_user)
        if not exists:
            size = int(f.size or 0)
            if size > 0:
                current_user.disk_usage = max(
                    0, int(current_user.disk_usage or 0) - size)
            db.session.delete(f)
            cleaned = True

    if cleaned:
        db.session.commit()

    q = UserFile.query.filter_by(
        user_id=current_user.id).order_by(
        UserFile.created_at.desc())
    total = q.count()
    pages = max(1, math.ceil(total / per_page)) if per_page else 1

    items = (
        q.offset((page - 1) * per_page)
        .limit(per_page)
        .all()
    )

    return jsonify(
        {
            "items": [f.to_dict() for f in items],
            "page": page,
            "per_page": per_page,
            "total": total,
            "pages": pages,
        }
    )


@files_bp.route("/delete", methods=["DELETE"])
@token_required
def delete_file(current_user):
    data = request.get_json(silent=True) or {}
    file_id = data.get("file_id") or data.get("id")
    if not file_id:
        return jsonify({"error": "file_id is required"}), 400

    f = UserFile.query.filter_by(id=file_id, user_id=current_user.id).first()
    if not f:
        return jsonify({"error": "File not found"}), 404

    _delete_from_s3(f.url)
    _delete_from_ydisk(f.url, current_user)

    try:
        size = int(f.size or 0)
        if size > 0:
            current_user.disk_usage = max(
                0, int(current_user.disk_usage or 0) - size)
    except Exception:
        pass

    db.session.delete(f)
    db.session.commit()

    return jsonify({"ok": True, "deleted_id": file_id})
