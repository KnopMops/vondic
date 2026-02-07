from functools import wraps

from app.services.auth_service import AuthService
from flask import jsonify, request


def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        data = request.get_json(silent=True)
        if data is None:
            return jsonify({"error": "Request body must be JSON"}), 400

        token = data.get("access_token")
        if not token:
            return jsonify({"error": "access_token is missing in body"}), 401

        user, error = AuthService.get_user_by_token(token)

        if error:
            return jsonify({"error": error}), 401

        return f(current_user=user, *args, **kwargs)

    return decorated
