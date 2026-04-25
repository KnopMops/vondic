from app.schemas.user_schema import user_schema
from app.services.auth_service import AuthService
from app.services.user_service import UserService
from flask import Blueprint, jsonify, request

public_account_bp = Blueprint(
    "public_account", __name__, url_prefix="/api/public/v1/account"
)


def _get_current_user():
    """Get current user from either access_token or api_key."""
    data = request.get_json(silent=True) or {}

    access_token = data.get("access_token")
    if not access_token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            access_token = auth_header.split(" ", 1)[1].strip()

    if access_token:
        user, error = AuthService.get_user_by_token(access_token)
        if user:
            return user, None
        return None, error

    api_key = data.get("api_key")
    if not api_key:
        api_key = request.headers.get("X-API-Key")
    if not api_key:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("ApiKey "):
            api_key = auth_header.split(" ", 1)[1].strip()

    if api_key:
        user = UserService.get_user_by_api_key(api_key)
        if user:
            return user, None
        return None, "Invalid api_key"

    return None, "access_token or api_key is missing"


@public_account_bp.route("/developer/toggle", methods=["POST"])
def toggle_developer():
    current_user, error = _get_current_user()
    if not current_user:
        return jsonify({"error": error}), 401
    data = request.get_json() or {}
    enable = bool(data.get("enable", True))
    user, error = UserService.set_developer(current_user.id, enable)
    if error:
        return jsonify({"error": error}), 400
    return jsonify({"user": user_schema.dump(user)}), 200


@public_account_bp.route("/api-key", methods=["POST"])
def generate_api_key():
    current_user, error = _get_current_user()
    if not current_user:
        return jsonify({"error": error}), 401
    data = request.get_json() or {}
    rotate = bool(data.get("rotate", False))
    token, error = UserService.generate_api_key(current_user.id, rotate=rotate)
    if error:
        return jsonify({"error": error}), 400
    return jsonify({"api_key": token}), 200


@public_account_bp.route("/api-key", methods=["GET"])
def get_api_key():
    current_user, error = _get_current_user()
    if not current_user:
        return jsonify({"error": error}), 401
    token, error = UserService.get_api_key(current_user.id)
    if error:
        return jsonify({"error": error}), 400
    return jsonify({"api_key": token}), 200
