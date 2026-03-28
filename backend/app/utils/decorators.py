import time
from collections import defaultdict, deque
from functools import wraps
from threading import Lock

from app.services.auth_service import AuthService
from app.services.user_service import UserService
from flask import jsonify, request

_RATE_BUCKETS = defaultdict(deque)
_RATE_LOCK = Lock()

def _client_key():
    forwarded = request.headers.get("X-Forwarded-For", "")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.remote_addr or "unknown"

def rate_limit(key_prefix: str, limit: int, window_seconds: int):
    def decorator(f):
        @wraps(f)
        def decorated(*args, **kwargs):
            now = time.time()
            key = f"{key_prefix}:{_client_key()}"
            with _RATE_LOCK:
                bucket = _RATE_BUCKETS[key]
                cutoff = now - window_seconds
                while bucket and bucket[0] <= cutoff:
                    bucket.popleft()
                if len(bucket) >= limit:
                    return jsonify({"error": "Too many requests"}), 429
                bucket.append(now)
            return f(*args, **kwargs)

        return decorated

    return decorator

def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        # Skip authentication for OPTIONS requests (CORS preflight)
        if request.method == 'OPTIONS':
            return f(*args, **kwargs)
        
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
