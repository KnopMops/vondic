import hashlib
import json
import uuid
from datetime import datetime, timezone
from urllib.parse import parse_qs, urlencode, urlparse, urlunparse

from app.core.extensions import cache
from app.schemas.user_schema import user_schema
from app.services.auth_service import AuthService
from app.services.user_service import UserService
from app.utils.decorators import rate_limit, token_required
from flask import Blueprint, current_app, jsonify, request
from itsdangerous import URLSafeTimedSerializer

auth_bp = Blueprint("auth", __name__, url_prefix="/api/v1/auth")

desktop_yandex_sessions: dict[str, dict] = {}

def _get_client_ip():
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    real_ip = request.headers.get("x-real-ip")
    if real_ip:
        return real_ip.strip()
    return request.remote_addr or ""

def _parse_user_agent(ua_string: str):

    ua_string = ua_string.lower()
    if "mobile" in ua_string or "android" in ua_string or "iphone" in ua_string:
        device = "mobile"
    else:
        device = "desktop"

    platform = "unknown"
    if "windows" in ua_string:
        platform = "Windows"
    elif "mac os" in ua_string:
        platform = "Mac OS"
    elif "linux" in ua_string:
        platform = "Linux"
    elif "android" in ua_string:
        platform = "Android"
    elif "ios" in ua_string or "iphone" in ua_string:
        platform = "iOS"

    browser = "unknown"
    if "chrome" in ua_string:
        browser = "Chrome"
    elif "firefox" in ua_string:
        browser = "Firefox"
    elif "safari" in ua_string:
        browser = "Safari"
    elif "edge" in ua_string:
        browser = "Edge"

    return device, platform, browser

def _extract_access_token():
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

def _store_login_session(
        user,
        access_token: str | None,
        refresh_token: str | None):
    try:
        if not user or not getattr(user, "id", None):
            return
        ttl = int(current_app.config.get("SESSION_TTL_SECONDS", 2592000))
        now = datetime.now(timezone.utc).isoformat()
        ip = _get_client_ip()
        user_agent_str = request.headers.get("user-agent") or ""
        device, platform, browser = _parse_user_agent(user_agent_str)
        session_id = str(uuid.uuid4())
        payload = {
            "session_id": session_id,
            "user_id": str(user.id),
            "created_at": now,
            "last_seen": now,
            "ip": ip,
            "user_agent": user_agent_str,
            "device": device,
            "platform": platform,
            "browser": browser,
            "access_token_hash": hashlib.sha256(
                (access_token or "").encode("utf-8")
            ).hexdigest()
            if access_token
            else None,
            "refresh_token_hash": hashlib.sha256(
                (refresh_token or "").encode("utf-8")
            ).hexdigest()
            if refresh_token
            else None,
        }
        key = f"sessions:{user.id}"
        existing = cache.get(key) or []
        if isinstance(existing, dict):
            existing = [existing]
        if not isinstance(existing, list):
            existing = []

        existing.insert(0, payload)
        existing = existing[:50]

        cache.set(key, existing, timeout=ttl)
        cache.set(f"session:{session_id}", payload, timeout=ttl)

        cache.set(
            f"sessions_json:{user.id}",
            json.dumps(existing, ensure_ascii=False),
            timeout=ttl,
        )
        cache.set(
            f"session_json:{session_id}",
            json.dumps(payload, ensure_ascii=False),
            timeout=ttl,
        )
        current_app.logger.info(
            f"Stored session {session_id} for user {user.id} in Redis"
        )
    except Exception as e:
        current_app.logger.error(
            f"Failed to store login session in Redis: {e}")

@auth_bp.route("/register", methods=["POST"])
@rate_limit("auth-register", limit=5, window_seconds=60)
def register():
    data = request.get_json()
    if not data:
        return (jsonify({"error": "Нет данных"}), 400)
    user, error = AuthService.register_user(data)
    if error:
        return (jsonify({"error": error}), 400)
    try:
        _store_login_session(user, user.access_token, user.refresh_token)
    except Exception:
        pass
    return (
        jsonify(
            {
                "message": "Пользователь зарегистрирован. Пожалуйста, проверьте свою почту для подтверждения.",
                "user": user_schema.dump(user),
                "access_token": user.access_token,
                "refresh_token": user.refresh_token,
            }),
        201,
    )

@auth_bp.route("/verify-email/<token>", methods=["GET"])
def verify_email(token):
    success, message = AuthService.verify_email(token)
    if not success:
        return (jsonify({"error": message}), 400)
    return (jsonify({"message": message}), 200)

@auth_bp.route("/login", methods=["POST"])
@rate_limit("auth-login", limit=10, window_seconds=60)
def login():
    try:

        raw_data = request.get_data(as_text=True)
        current_app.logger.info(f"Raw login data: {raw_data}")

        if raw_data and '\\"' in raw_data:

            raw_data = raw_data.replace('\\"', '"')
            current_app.logger.info(f"Fixed raw data: {raw_data}")

        data = request.get_json()
        current_app.logger.info(f"Parsed login data: {data}")

        if not data:
            return (jsonify({"error": "No data provided"}), 400)

        email = data.get("email")
        password = data.get("password")
        current_app.logger.info(f"Email: {email}, Password length: {len(password) if password else 0}")

    except Exception as e:
        current_app.logger.error(f"JSON parsing error: {e}")
        return (jsonify({"error": "Неверный формат JSON"}), 400)

    result, error = AuthService.login_user(data)
    if error:
        if error == "TwoFactorEmailRequired":
            try:
                email = (data or {}).get("email")
                user = UserService.get_user_by_email(email) if email else None
                if user:
                    AuthService.send_2fa_email_code(user)
            except Exception:
                pass
            return jsonify(
                {"two_factor_required": True, "method": "email"}), 401
        if error == "TwoFactorTotpRequired":
            return jsonify(
                {"two_factor_required": True, "method": "totp"}), 401
        status_code = (
            401
            if error
            in [
                "Invalid email or password",
                "User is blocked",
                "Email not verified",
                "InvalidTwoFactorCode",
            ]
            else 400
        )
        return (jsonify({"error": error}), status_code)
    _store_login_session(
        result["user"], result["access_token"], result["refresh_token"]
    )
    return (
        jsonify(
            {
                "message": "Вход выполнен успешно",
                "access_token": result["access_token"],
                "refresh_token": result["refresh_token"],
                "user": user_schema.dump(result["user"]),
            }
        ),
        200,
    )

@auth_bp.route("/me", methods=["POST"])
def me():
    data = request.get_json() or {}
    token = data.get("access_token")

    if not token:
        return jsonify({"error": "Требуется access_token"}), 400

    user, error = AuthService.get_user_by_token(token)

    if error:
        return jsonify({"error": error, "is_authenticated": False}), 401

    return (
        jsonify(
            {
                "message": "Пользователь авторизован",
                "is_authenticated": True,
                "user": user_schema.dump(user),
            }
        ),
        200,
    )

@auth_bp.route("/socket-token", methods=["GET"])
@token_required
@rate_limit("socket-token", limit=20, window_seconds=60)
def socket_token(current_user):
    serializer = URLSafeTimedSerializer(current_app.config["SECRET_KEY"])
    token = serializer.dumps(
        {"uid": str(current_user.id)}, salt="socket-token")
    return jsonify({"token": token, "expires_in": 300}), 200

@auth_bp.route("/yandex/login", methods=["GET"])
def yandex_login():
    cid = request.args.get("cid")
    auth_url, error = AuthService.get_yandex_auth_url()
    if error:
        return jsonify({"error": error}), 400
    if cid and auth_url:
        parsed = urlparse(auth_url)
        query = parse_qs(parsed.query)
        query["state"] = [cid]
        new_query = urlencode(query, doseq=True)
        auth_url = urlunparse(
            (
                parsed.scheme,
                parsed.netloc,
                parsed.path,
                parsed.params,
                new_query,
                parsed.fragment,
            )
        )
    return jsonify({"auth_url": auth_url}), 200

@auth_bp.route("/yandex/callback", methods=["GET"])
def yandex_callback():
    code = request.args.get("code")
    cid = request.args.get("state") or request.args.get("cid")
    if not code:
        return jsonify({"error": "Не предоставлен код"}), 400

    result, error = AuthService.login_yandex_user(code)
    if error:
        return jsonify({"error": error}), 400

    response_payload = {
        "message": "Вход выполнен успешно",
        "access_token": result["access_token"],
        "refresh_token": result["refresh_token"],
        "user": user_schema.dump(result["user"]),
    }
    _store_login_session(
        result["user"], result["access_token"], result["refresh_token"]
    )

    if cid:
        desktop_yandex_sessions[cid] = response_payload

    return jsonify(response_payload), 200

@auth_bp.route("/yandex/desktop-session", methods=["GET"])
def yandex_desktop_session():
    cid = request.args.get("cid")
    if not cid:
        return jsonify({"error": "Требуется cid"}), 400

    data = desktop_yandex_sessions.get(cid)
    if not data:
        return jsonify({"ready": False}), 200

    return jsonify(
        {
            "ready": True,
            "access_token": data.get("access_token"),
            "refresh_token": data.get("refresh_token"),
            "user": data.get("user"),
        }
    ), 200

@auth_bp.route("/2fa/setup", methods=["POST"])
@token_required
def setup_2fa(current_user):
    data = request.get_json() or {}
    method = data.get("method")
    enable = bool(data.get("enable", True))
    user, error = AuthService.setup_2fa(current_user, method, enable)
    if error:
        return jsonify({"error": error}), 400
    return jsonify({"user": user_schema.dump(user)}), 200

@auth_bp.route("/2fa/email/send", methods=["POST"])
@token_required
def send_2fa_email(current_user):
    success, error = AuthService.send_2fa_email_code(current_user)
    if not success:
        mail_server = current_app.config.get("MAIL_SERVER")
        env = current_app.config.get("ENV")
        if not mail_server or (env and env != "production"):
            return jsonify(
                {
                    "message": "Code generated (dev)",
                    "dev_code": current_user.two_factor_email_code,
                }
            ), 200
        return jsonify({"error": error}), 400
    return jsonify({"message": "Code sent"}), 200

@auth_bp.route("/2fa/email/verify", methods=["POST"])
@token_required
def verify_2fa_email(current_user):
    data = request.get_json() or {}
    code = data.get("code")
    success, error = AuthService.verify_2fa_email_code(current_user, code)
    if not success:
        return jsonify({"error": error}), 400
    return jsonify({"message": "Код 2FA подтверждён"}), 200

@auth_bp.route("/login-alerts/toggle", methods=["POST"])
@token_required
def toggle_login_alerts(current_user):
    data = request.get_json() or {}
    enable = bool(data.get("enable", True))
    success, error = AuthService.toggle_login_alerts(current_user, enable)
    if not success:
        return jsonify({"error": error}), 400
    return jsonify({"message": "Настройки оповещений о входе обновлены"}), 200

@auth_bp.route("/sessions", methods=["GET"])
@token_required
def list_sessions(current_user):
    token = _extract_access_token()
    current_hash = hashlib.sha256(token.encode(
        "utf-8")).hexdigest() if token else None
    key = f"sessions:{current_user.id}"
    sessions = cache.get(key)
    if sessions is None:
        json_value = cache.get(f"sessions_json:{current_user.id}")
        if isinstance(json_value, str):
            try:
                sessions = json.loads(json_value)
            except Exception:
                sessions = []
    if isinstance(sessions, dict):
        sessions = [sessions]
    if not isinstance(sessions, list):
        sessions = []
    items = []
    for item in sessions:
        if not isinstance(item, dict):
            continue
        item_copy = dict(item)
        if current_hash and item_copy.get("access_token_hash") == current_hash:
            item_copy["is_current"] = True
        else:
            item_copy["is_current"] = False
        items.append(item_copy)
    return jsonify({"items": items}), 200

@auth_bp.route("/sessions/terminate", methods=["POST"])
@token_required
def terminate_session(current_user):
    data = request.get_json() or {}
    session_id = data.get("session_id")
    if not session_id:
        return jsonify({"error": "Требуется session_id"}), 400
    token = _extract_access_token()
    current_hash = hashlib.sha256(token.encode(
        "utf-8")).hexdigest() if token else None
    key = f"sessions:{current_user.id}"
    sessions = cache.get(key)
    if sessions is None:
        json_value = cache.get(f"sessions_json:{current_user.id}")
        if isinstance(json_value, str):
            try:
                sessions = json.loads(json_value)
            except Exception:
                sessions = []
    if isinstance(sessions, dict):
        sessions = [sessions]
    if not isinstance(sessions, list):
        sessions = []
    target = next(
        (
            s
            for s in sessions
            if isinstance(s, dict) and s.get("session_id") == session_id
        ),
        None,
    )
    updated = [s for s in sessions if isinstance(
        s, dict) and s.get("session_id") != session_id]
    ttl = int(current_app.config.get("SESSION_TTL_SECONDS", 2592000))
    cache.set(key, updated, timeout=ttl)
    cache.set(
        f"sessions_json:{current_user.id}",
        json.dumps(updated, ensure_ascii=False),
        timeout=ttl,
    )
    revoked_key = f"revoked_tokens:{current_user.id}"
    revoked = cache.get(revoked_key) or []
    if not isinstance(revoked, list):
        revoked = []
    access_hash = target.get("access_token_hash") if isinstance(
        target, dict) else None
    refresh_hash = (
        target.get("refresh_token_hash") if isinstance(target, dict) else None
    )
    if access_hash:
        revoked.append(access_hash)
    if refresh_hash:
        revoked.append(refresh_hash)
    if revoked:
        unique_revoked = []
        for value in revoked:
            if value and value not in unique_revoked:
                unique_revoked.append(value)
        cache.set(revoked_key, unique_revoked[:200], timeout=ttl)
    cache.delete(f"session:{session_id}")
    cache.delete(f"session_json:{session_id}")
    logout_current = bool(
        access_hash and current_hash and access_hash == current_hash)
    return jsonify(
        {
            "message": "Сессия завершена",
            "items": updated,
            "logout_current": logout_current,
        }
    ), 200

@auth_bp.route("/api-key-login", methods=["POST"])
@rate_limit("auth-api-key-login", limit=20, window_seconds=60)
def api_key_login():
    data = request.get_json() or {}
    api_key = data.get("api_key")
    cloud_password = data.get("cloud_password")
    if not api_key:
        return jsonify({"error": "Требуется api_key"}), 400

    user = UserService.get_user_by_api_key(api_key)
    if not user:
        return jsonify({"error": "Неверный api_key"}), 401

    if cloud_password:
        error_msg = UserService.set_or_reset_cloud_password(
            user, cloud_password)
        if error_msg:
            return jsonify({"error": error_msg}), 400

    tokens, error = AuthService.login_with_user(user)
    if error:
        return jsonify({"error": error}), 400
    try:
        _store_login_session(
            tokens["user"], tokens["access_token"], tokens["refresh_token"]
        )
    except Exception:
        pass

    return (
        jsonify(
            {
                "message": "Вход выполнен успешно",
                "access_token": tokens["access_token"],
                "refresh_token": tokens["refresh_token"],
                "user": user_schema.dump(tokens["user"]),
                "cloud_password_set": bool(
                    getattr(tokens["user"], "cloud_password_hash", None)
                ),
                "cloud_password_resets_used": int(
                    getattr(tokens["user"],
                            "cloud_password_reset_count", 0) or 0
                ),
                "cloud_password_resets_limit": 3,
            }
        ),
        200,
    )

@auth_bp.route("/ai-user", methods=["GET"])
def get_ai_user():
    from app.services.ollama_service import OllamaService

    ai_user = OllamaService.get_ai_user()
    return jsonify(user_schema.dump(ai_user)), 200
