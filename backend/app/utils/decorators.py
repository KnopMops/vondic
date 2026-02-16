from functools import wraps

from app.services.auth_service import AuthService
from app.services.user_service import UserService
from flask import jsonify, request


def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        data = request.get_json(silent=True) or {}
        token = data.get("access_token")
        if not token:
            auth_header = request.headers.get("Authorization", "")
            if auth_header.startswith("Bearer "):
                token = auth_header.split(" ", 1)[1].strip()
        if not token:
            token = request.args.get("access_token")
        if not token:
            token = request.cookies.get("access_token")
        if not token:
            return jsonify({"error": "access_token is missing"}), 401

        user, error = AuthService.get_user_by_token(token)

        if error:
            return jsonify({"error": error}), 401

        return f(current_user=user, *args, **kwargs)

    decorated._auth_required = True
    return decorated


def api_key_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        data = request.get_json(silent=True) or {}
        api_key = data.get("api_key")
        if not api_key:
            api_key = request.headers.get("X-API-Key")
        if not api_key:
            auth_header = request.headers.get("Authorization", "")
            if auth_header.startswith("ApiKey "):
                api_key = auth_header.split(" ", 1)[1].strip()
        if not api_key:
            return jsonify({"error": "api_key is missing"}), 401

        user = UserService.get_user_by_api_key(api_key)
        if not user:
            return jsonify({"error": "Invalid api_key"}), 401

        return f(current_user=user, *args, **kwargs)

    decorated._api_key_required = True
    return decorated
