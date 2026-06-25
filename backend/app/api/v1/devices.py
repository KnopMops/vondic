from app.core.extensions import db
from app.models.device import Device
from app.utils.decorators import token_required
from flask import Blueprint, jsonify, request

devices_bp = Blueprint("devices", __name__, url_prefix="/api/v1/devices")


@devices_bp.route("/register", methods=["POST"])
@token_required
def register_device(current_user):
    data = request.get_json(silent=True) or {}
    token = (data.get("token") or "").strip()
    platform = (data.get("platform") or "android").strip().lower()
    device_type = (data.get("device_type") or "mobile").strip().lower()

    if not token:
        return jsonify({"error": "token is required"}), 400

    existing = Device.query.filter_by(token=token).first()
    if existing:
        if str(existing.user_id) != str(current_user.id):
            existing.user_id = current_user.id
            existing.platform = platform
            existing.device_type = device_type
            db.session.commit()
        return jsonify({"ok": True, "device_id": existing.id})

    device = Device(
        user_id=str(current_user.id),
        token=token,
        platform=platform,
        device_type=device_type,
    )
    db.session.add(device)
    db.session.commit()
    return jsonify({"ok": True, "device_id": device.id}), 201
