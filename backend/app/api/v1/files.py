import math

from app.utils.decorators import token_required
from flask import Blueprint, jsonify, request

from app.core.extensions import db
from app.models.user_file import UserFile

files_bp = Blueprint("files", __name__, url_prefix="/api/v1/files")


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
