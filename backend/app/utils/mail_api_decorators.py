from functools import wraps

from app.services.mail_api_service import user_has_mail_permission
from app.services.user_service import UserService
from flask import jsonify, request


def _resolve_api_key_user():
    data = request.get_json(silent=True) or {}
    api_key = data.get("api_key")
    if not api_key:
        api_key = request.headers.get("X-API-Key")
    if not api_key:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("ApiKey "):
            api_key = auth_header.split(" ", 1)[1].strip()
    if not api_key:
        api_key = request.args.get("api_key")
    if not api_key:
        return None
    return UserService.get_user_by_api_key(api_key)


def mail_api_key_only(f):
    @wraps(f)
    def wrapped(*args, **kwargs):
        user = _resolve_api_key_user()
        if not user:
            return jsonify({"error": "Invalid or missing api_key"}), 401
        if not user.is_developer:
            return jsonify({"error": "Developer mode required for Mail API"}), 403
        return f(current_user=user, *args, **kwargs)

    wrapped._mail_api_key_only = True
    return wrapped


def mail_api_key_required(permission: str):
    def decorator(f):
        @wraps(f)
        def wrapped(*args, **kwargs):
            user = _resolve_api_key_user()
            if not user:
                return jsonify({"error": "Invalid or missing api_key"}), 401
            if not user.is_developer:
                return jsonify({"error": "Developer mode required for Mail API"}), 403
            if not user_has_mail_permission(user, permission):
                return (
                    jsonify(
                        {
                            "error": (
                                f"Mail API permission '{permission}' is disabled. "
                                "Enable it in Settings → Почта."
                            )
                        }
                    ),
                    403,
                )
            return f(current_user=user, *args, **kwargs)

        wrapped._mail_api_key_required = True
        return wrapped

    return decorator
