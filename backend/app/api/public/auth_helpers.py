from functools import wraps

from app.services.auth_service import AuthService
from app.services.user_service import UserService
from flask import jsonify, request


def extract_access_token():
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
    return token


def extract_api_key():
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
    return api_key


def get_current_user():
    token = extract_access_token()
    if token:
        user, error = AuthService.get_user_by_token(token)
        if user:
            return user, None, token
        return None, error or "Invalid access_token", None

    api_key = extract_api_key()
    if api_key:
        user = UserService.get_user_by_api_key(api_key)
        if user:
            return user, None, None
        return None, "Invalid api_key", None

    return None, "access_token or api_key is missing", None


def resolve_realtime_token(access_token: str | None) -> str | None:
    """Token for WebRTC: access_token, or api_key (supported by signaling server)."""
    if access_token:
        return access_token
    return extract_api_key()


def embed_auth_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if request.method == "OPTIONS":
            return f(current_user=None, access_token=None, *args, **kwargs)

        user, error, access_token = get_current_user()
        if not user:
            return jsonify({"error": error}), 401
        return f(current_user=user, access_token=access_token, *args, **kwargs)

    decorated._auth_required = True
    return decorated
