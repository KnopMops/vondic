from functools import wraps

from app.services.auth_service import AuthService
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

    return decorated
