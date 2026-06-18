import time
from collections import defaultdict, deque
from datetime import datetime
from functools import wraps
from threading import Lock

from app.services.auth_service import AuthService
from app.services.user_service import UserService
from flask import jsonify, request

_RATE_BUCKETS = defaultdict(deque)
_RATE_LOCK = Lock()

_FAILED_LOGINS: dict[str, deque] = defaultdict(deque)
_LOCKED_IPS: dict[str, float] = {}
_LOCKOUT_COUNTS: dict[str, int] = defaultdict(int)

FAILED_LOGIN_LIMIT = 10
FAILED_LOGIN_WINDOW = 600
RESET_LINK_THRESHOLD = 5

LOCKOUT_DURATIONS = [
    900,
    1800,
    86400,
    604800,
]


def _get_lockout_duration(count: int) -> int:
    if count <= 0:
        return LOCKOUT_DURATIONS[0]
    if count >= len(LOCKOUT_DURATIONS):
        return LOCKOUT_DURATIONS[-1]
    return LOCKOUT_DURATIONS[count]


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


def csrf_protect(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if request.method in ("GET", "HEAD", "OPTIONS"):
            return f(*args, **kwargs)

        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            return f(*args, **kwargs)

        origin = request.headers.get("Origin") or ""
        referer = request.headers.get("Referer") or ""

        allowed = ("https://vondic.ru", "https://api.vondic.ru",
                    "http://localhost:3000", "http://localhost:5050",
                    "http://127.0.0.1:3000")

        if origin:
            if not any(origin.startswith(a) for a in allowed):
                return jsonify({"error": "CSRF origin mismatch"}), 403
        elif referer:
            if not any(referer.startswith(a) for a in allowed):
                return jsonify({"error": "CSRF referer mismatch"}), 403
        else:
            if request.content_type and "json" in request.content_type:
                return jsonify({"error": "CSRF: missing Origin/Referer"}), 403

        return f(*args, **kwargs)

    return decorated


def _lockout_minutes(seconds: int) -> str:
    if seconds < 3600:
        return f"{seconds // 60} минут"
    if seconds < 86400:
        return f"{seconds // 3600} часов"
    return f"{seconds // 86400} дней"


def record_failed_login(ip: str, user=None) -> str | None:
    """Returns 'send_reset_link' if IP == registration_ip and threshold reached."""
    now = time.time()
    with _RATE_LOCK:
        bucket = _FAILED_LOGINS[ip]
        cutoff = now - FAILED_LOGIN_WINDOW
        while bucket and bucket[0] <= cutoff:
            bucket.popleft()
        bucket.append(now)
        count = len(bucket)

        if user and count >= RESET_LINK_THRESHOLD:
            if user.registration_ip and user.registration_ip == ip:
                return "send_reset_link"

        if count >= FAILED_LOGIN_LIMIT:
            lock_count = _LOCKOUT_COUNTS[ip]
            duration = _get_lockout_duration(lock_count)
            _LOCKED_IPS[ip] = now + duration
            _LOCKOUT_COUNTS[ip] = lock_count + 1
            if user and not user.is_blocked_system:
                if not user.registration_ip or user.registration_ip != ip:
                    user.is_blocked_system = 1
                    try:
                        from app.core.extensions import db
                        db.session.commit()
                    except Exception:
                        db.session.rollback()
    return None


def is_ip_locked(ip: str) -> tuple[bool, int]:
    with _RATE_LOCK:
        lock_until = _LOCKED_IPS.get(ip)
        if lock_until and time.time() < lock_until:
            return True, int(lock_until - time.time())
        if lock_until and time.time() >= lock_until:
            _LOCKED_IPS.pop(ip, None)
            _FAILED_LOGINS.pop(ip, None)
        return False, 0


def clear_failed_logins(ip: str):
    with _RATE_LOCK:
        _FAILED_LOGINS.pop(ip, None)
        _LOCKED_IPS.pop(ip, None)
        _LOCKOUT_COUNTS.pop(ip, None)


def check_ip_blocked():
    ip = _client_key()
    locked, seconds_left = is_ip_locked(ip)
    if locked:
        return jsonify({
            "error": f"Ваш IP временно заблокирован. Попробуйте через {_lockout_minutes(seconds_left)}."
        }), 429
    return None


def check_account_access(user):
    ip = _client_key()

    if user.is_blocked:
        return jsonify({
            "error": "Аккаунт заблокирован администратором."
        }), 403

    if user.is_blocked_system:
        if user.registration_ip and ip == user.registration_ip:
            return None
        return jsonify({
            "error": "Аккаунт временно заблокирован системой безопасности. Восстановите аккаунт через почту."
        }), 403

    return None


def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if request.method == 'OPTIONS':
            return f(*args, **kwargs)

        blocked = check_ip_blocked()
        if blocked:
            return blocked

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

        access_denied = check_account_access(user)
        if access_denied:
            return access_denied

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

        access_denied = check_account_access(user)
        if access_denied:
            return access_denied

        return f(current_user=user, *args, **kwargs)

    decorated._api_key_required = True
    return decorated


def premium_required(f):
    @wraps(f)
    def decorated(current_user, *args, **kwargs):
        if not current_user.premium or (
            current_user.premium_expired_at
            and current_user.premium_expired_at < datetime.utcnow()
        ):
            return (
                jsonify(
                    {"error": "Доступно только с подпиской Vondic Premium"}
                ),
                403,
            )
        return f(current_user, *args, **kwargs)

    return decorated
