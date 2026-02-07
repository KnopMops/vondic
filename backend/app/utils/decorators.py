from functools import wraps

from app.services.auth_service import AuthService
from flask import jsonify, request


def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get("Authorization")
        if not auth_header:
            return jsonify({"error": "Missing Authorization header"}), 401

        if not auth_header.startswith("Bearer "):
            return jsonify({"error": "Invalid Authorization header format"}), 401

        token = auth_header.split(" ")[1]
        user, error = AuthService.get_user_by_token(token)

        if error:
            return jsonify({"error": error}), 401

        return f(current_user=user, *args, **kwargs)

    return decorated
