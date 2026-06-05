from app.core.extensions import db
from app.services.app_download_service import AppDownloadService
from app.utils.decorators import token_required
from flask import Blueprint, jsonify, request

app_downloads_bp = Blueprint(
    "app_downloads", __name__, url_prefix="/api/v1/app-downloads"
)


@app_downloads_bp.route("/", methods=["GET"])
def get_app_downloads():
    return jsonify({"downloads": AppDownloadService.get_downloads()}), 200


@app_downloads_bp.route("/admin", methods=["GET"])
@token_required
def get_app_downloads_admin(current_user):
    if getattr(current_user, "role", "") != "Admin":
        return jsonify({"error": "Forbidden"}), 403
    return jsonify({"downloads": AppDownloadService.get_downloads()}), 200


@app_downloads_bp.route("/admin", methods=["PUT"])
@token_required
def update_app_downloads_admin(current_user):
    if getattr(current_user, "role", "") != "Admin":
        return jsonify({"error": "Forbidden"}), 403
    data = request.get_json() or {}
    patch = data.get("downloads") if isinstance(data.get("downloads"), dict) else data
    try:
        merged = AppDownloadService.update_downloads(patch)
        return jsonify({"downloads": merged}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500
