from app.schemas.user_schema import user_schema
from app.services.user_service import UserService
from app.utils.decorators import api_key_required
from flask import Blueprint, jsonify, request

public_account_bp = Blueprint(
    "public_account", __name__, url_prefix="/api/public/v1/account"
)

@public_account_bp.route("/developer/toggle", methods=["POST"])
@api_key_required
def toggle_developer(current_user):
    data = request.get_json() or {}
    enable = bool(data.get("enable", True))
    user, error = UserService.set_developer(current_user.id, enable)
    if error:
        return jsonify({"error": error}), 400
    return jsonify({"user": user_schema.dump(user)}), 200

@public_account_bp.route("/api-key", methods=["POST"])
@api_key_required
def generate_api_key(current_user):
    data = request.get_json() or {}
    rotate = bool(data.get("rotate", False))
    token, error = UserService.generate_api_key(current_user.id, rotate=rotate)
    if error:
        return jsonify({"error": error}), 400
    return jsonify({"api_key": token}), 200

@public_account_bp.route("/api-key", methods=["GET"])
@api_key_required
def get_api_key(current_user):
    token, error = UserService.get_api_key(current_user.id)
    if error:
        return jsonify({"error": error}), 400
    return jsonify({"api_key": token}), 200
