import hashlib
import json
import uuid
from datetime import datetime, timezone
from urllib.parse import parse_qs, urlencode, urlparse, urlunparse

from app.core.config import Config
from app.core.extensions import cache
from app.schemas.user_schema import user_schema
from app.services.auth_service import AuthService
from app.services.user_service import UserService
from app.utils.decorators import rate_limit, token_required, csrf_protect, record_failed_login, is_ip_locked, clear_failed_logins
from flask import Blueprint, current_app, jsonify, request
from itsdangerous import URLSafeTimedSerializer
import requests

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


def _verify_smart_captcha(token: str | None) -> tuple[bool, str | None]:
    server_key = Config.YANDEX_SMARTCAPTCHA_SERVER_KEY

    if not server_key:
        return True, None
    if not token:
        return False, "Подтвердите, что вы не робот"
    try:
        response = requests.post(
            "https://smartcaptcha.yandexcloud.net/validate",
            data={
                "secret": server_key,
                "token": token,
                "ip": _get_client_ip(),
            },
            timeout=8,
        )
        payload = response.json() if response.content else {}
        if response.ok and payload.get("status") == "ok":
            return True, None
        return False, payload.get("message") or "Капча не пройдена"
    except Exception:
        return False, "Не удалось проверить капчу"


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
        device_key = f"{device}|{platform}|{browser}"

        access_hash = (
            hashlib.sha256((access_token or "").encode("utf-8")).hexdigest()
            if access_token
            else None
        )
        refresh_hash = (
            hashlib.sha256((refresh_token or "").encode("utf-8")).hexdigest()
            if refresh_token
            else None
        )

        key = f"sessions:{user.id}"
        existing = cache.get(key) or []
        if isinstance(existing, dict):
            existing = [existing]
        if not isinstance(existing, list):
            existing = []

        session_id = None
        match_index = None
        for idx, item in enumerate(existing):
            if not isinstance(item, dict):
                continue
            if item.get("device_key") != device_key:
                continue
            old_id = item.get("session_id")
            if old_id and cache.get(f"session:{old_id}"):
                match_index = idx
                session_id = old_id
                break

        if session_id and match_index is not None:
            created_at = existing[match_index].get("created_at") or now
            payload = {
                **existing[match_index],
                "session_id": session_id,
                "user_id": str(user.id),
                "created_at": created_at,
                "last_seen": now,
                "ip": ip,
                "user_agent": user_agent_str,
                "device": device,
                "platform": platform,
                "browser": browser,
                "device_key": device_key,
                "access_token_hash": access_hash,
                "refresh_token_hash": refresh_hash,
            }
            existing[match_index] = payload
            current_app.logger.info(
                "Reused session %s for user %s (%s)",
                session_id,
                user.id,
                device_key,
            )
        else:
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
                "device_key": device_key,
                "access_token_hash": access_hash,
                "refresh_token_hash": refresh_hash,
            }
            existing.insert(0, payload)
            current_app.logger.info(
                "Stored new session %s for user %s (%s)",
                session_id,
                user.id,
                device_key,
            )

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
    except Exception as e:
        current_app.logger.error(
            f"Failed to store login session in Redis: {e}")


@rate_limit("auth-register", limit=5, window_seconds=60)
@csrf_protect
@auth_bp.route("/register", methods=["POST"])
def register():
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "Нет данных"}), 400
    from app.utils.email_utils import normalize_email

    if data.get("email"):
        data = {**data, "email": normalize_email(data.get("email"))}
    if data.get("username"):
        data = {**data, "username": (data.get("username") or "").strip()}
    captcha_token = (
        data.get("smart_captcha_token")
        or data.get("captcha_token")
        or data.get("smart-token")
    )
    captcha_ok, captcha_error = _verify_smart_captcha(captcha_token)
    if not captcha_ok:
        return jsonify({"error": captcha_error}), 400
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


@auth_bp.route("/check-email", methods=["POST"])
def check_email():
    """Проверка формата и занятости email при регистрации."""
    data = request.get_json(silent=True) or {}
    from app.utils.email_utils import email_exists, normalize_email

    raw = data.get("email") or ""
    email, err = AuthService._validate_registration_email(raw)
    if err:
        return jsonify({"valid": False, "available": False, "error": err}), 200
    return jsonify(
        {
            "valid": True,
            "available": not email_exists(email),
            "email": normalize_email(email or raw),
        }
    ), 200


@rate_limit("auth-forgot-password", limit=5, window_seconds=60)
@csrf_protect
@auth_bp.route("/forgot-password", methods=["POST"])
def forgot_password():
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "Нет данных"}), 400
    from app.utils.email_utils import normalize_email

    email = normalize_email(data.get("email"))
    if not email:
        return jsonify({"error": "Укажите email"}), 400
    success, message = AuthService.request_password_reset(email)
    if not success:
        return jsonify({"error": message}), 400
    return jsonify({"message": message}), 200


@auth_bp.route("/reset-password", methods=["POST"])
def reset_password_route():
    data = request.get_json()
    if not data:
        return jsonify({"error": "Нет данных"}), 400
    token = data.get("token")
    new_password = data.get("new_password") or data.get("password")
    if not token or not new_password:
        return jsonify({"error": "Токен и новый пароль обязательны"}), 400
    success, message = AuthService.reset_password(token, new_password)
    if not success:
        return jsonify({"error": message}), 400
    return jsonify({"message": message}), 200


@auth_bp.route("/verify-email/<token>", methods=["GET"])
def verify_email(token):
    success, message = AuthService.verify_email(token)
    if not success:
        return (jsonify({"error": message}), 400)
    return (jsonify({"message": message}), 200)


@rate_limit("auth-login", limit=10, window_seconds=60)
@csrf_protect
@auth_bp.route("/login", methods=["POST"])
def login():
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "Неверный формат JSON"}), 400

    from app.utils.email_utils import normalize_email

    if data.get("email"):
        data = {**data, "email": normalize_email(data.get("email"))}

    email = data.get("email", "unknown")
    client_ip = _get_client_ip()

    locked, seconds_left = is_ip_locked(client_ip)
    if locked:
        from app.utils.decorators import _lockout_minutes
        return jsonify({"error": f"Ваш IP временно заблокирован. Попробуйте через {_lockout_minutes(seconds_left)}."}), 429

    current_app.logger.info(
        f"Login attempt for email: {email} from IP: {client_ip}"
    )

    if not data:
        return jsonify({"error": "No data provided"}), 400
    is_2fa_step = bool(data.get("email_code") or data.get("totp_code"))
    if not is_2fa_step:
        captcha_token = (
            data.get("smart_captcha_token")
            or data.get("captcha_token")
            or data.get("smart-token")
        )
        captcha_ok, captcha_error = _verify_smart_captcha(captcha_token)
        if not captcha_ok:
            return jsonify({"error": captcha_error}), 400

    result, error = AuthService.login_user(data)
    if error:
        if error in (
            "TwoFactorEmailRequired",
            "TwoFactorTotpRequired",
            "TwoFactorTotpNotConfigured",
        ):
            email = (data or {}).get("email")
            user = UserService.get_user_by_email(email) if email else None
            method = "email"
            if user:
                method = (user.two_factor_method or "email").strip().lower()
                if error == "TwoFactorEmailRequired" and method == "email":
                    try:
                        AuthService.send_2fa_email_code(user, for_login=True)
                    except Exception:
                        pass
            if error == "TwoFactorTotpNotConfigured":
                return jsonify(
                    {
                        "error": "Секретный ключ не настроен. Сгенерируйте его в настройках.",
                        "two_factor_required": True,
                        "method": "totp",
                    }
                ), 400
            return jsonify(
                {"two_factor_required": True, "method": method}), 401
        if error in ("Invalid email or password", "InvalidTwoFactorCode"):
            failed_user = UserService.get_user_by_email(email) if email else None
            action = record_failed_login(client_ip, failed_user)
            if action == "send_reset_link" and failed_user:
                try:
                    from app.services.auth_service import AuthService as AS
                    AS.request_password_reset(email)
                except Exception:
                    pass
                return jsonify({
                    "error": "Ссылка для восстановления аккаунта отправлена на почту",
                    "send_reset_link": True,
                    "email": email,
                }), 403
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
    clear_failed_logins(client_ip)

    user_obj = result["user"]

    if user_obj.is_blocked:
        return jsonify({"error": "Аккаунт заблокирован администратором."}), 403

    if user_obj.is_blocked_system:
        if user_obj.registration_ip and client_ip == user_obj.registration_ip:
            pass
        else:
            return jsonify({"error": "Аккаунт временно заблокирован системой безопасности. Восстановите аккаунт через почту."}), 403

    changed = False
    if not user_obj.registration_ip:
        user_obj.registration_ip = client_ip
        changed = True
    if user_obj.is_blocked_system:
        user_obj.is_blocked_system = 0
        changed = True
    if changed:
        try:
            from app.core.extensions import db
            db.session.commit()
        except Exception:
            db.session.rollback()

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


@auth_bp.route("/refresh", methods=["POST"])
def refresh_session():
    auth_header = request.headers.get("Authorization", "")
    token = None
    if auth_header.startswith("Bearer "):
        token = auth_header.split(" ", 1)[1].strip()
    if not token:
        body = request.get_json(silent=True) or {}
        token = (body.get("refresh_token") or "").strip()
    if not token:
        return jsonify({"error": "Требуется refresh_token"}), 400
    result, error = AuthService.refresh_with_refresh_token(token)
    if error:
        return jsonify({"error": error}), 401
    try:
        _store_login_session(
            result["user"], result["access_token"], result["refresh_token"]
        )
    except Exception:
        pass
    ud = user_schema.dump(result["user"])
    ud["moderation_warnings"] = (
        getattr(result["user"], "moderation_warnings", None) or []
    )
    return (
        jsonify(
            {
                "message": "Токены обновлены",
                "access_token": result["access_token"],
                "refresh_token": result["refresh_token"],
                "user": ud,
            }
        ),
        200,
    )


@auth_bp.route("/me", methods=["GET", "POST"])
def me():
    token = _extract_access_token()
    if not token:
        return jsonify({"error": "Требуется access_token"}), 400

    user, error = AuthService.get_user_by_token(token)

    if error:
        return jsonify({"error": error, "is_authenticated": False}), 401

    payload = user_schema.dump(user)
    payload["moderation_warnings"] = getattr(
        user, "moderation_warnings", None) or []

    return (
        jsonify(
            {
                "message": "Пользователь авторизован",
                "is_authenticated": True,
                "user": payload,
            }
        ),
        200,
    )


@rate_limit("socket-token", limit=20, window_seconds=60)
@auth_bp.route("/socket-token", methods=["GET"])
@token_required
def socket_token(current_user):
    serializer = URLSafeTimedSerializer(current_app.config["SECRET_KEY"])
    token = serializer.dumps(
        {"uid": str(current_user.id)}, salt="socket-token")
    return jsonify({"token": token, "expires_in": 300}), 200


@auth_bp.route("/yandex/login", methods=["GET"])
def yandex_login():
    cid = request.args.get("cid")
    login_hint = request.args.get("login_hint") or request.args.get("email")
    auth_url, error = AuthService.get_yandex_auth_url(login_hint=login_hint)
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
    regenerate_secret = bool(data.get("regenerate_secret", False))
    user, error = AuthService.setup_2fa(
        current_user, method, enable, regenerate_secret=regenerate_secret
    )
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


@auth_bp.route("/verify-password", methods=["POST"])
@token_required
def verify_password(current_user):
    data = request.get_json(silent=True) or {}
    password = (data.get("password") or "").strip()
    if not password:
        return jsonify({"success": False, "error": "Password required"}), 400
    if not current_user.check_password(password):
        return jsonify({"success": False, "error": "Invalid password"}), 401
    return jsonify({"success": True}), 200


@auth_bp.route("/change-password", methods=["POST"])
@token_required
@csrf_protect
def change_password(current_user):
    data = request.get_json(silent=True) or {}
    current_pwd = (data.get("current_password") or "").strip()
    new_pwd = (data.get("new_password") or "").strip()

    if not current_pwd or not new_pwd:
        return jsonify({"error": "Текущий и новый пароль обязательны"}), 400

    if len(new_pwd) < 6:
        return jsonify({"error": "Пароль должен быть не менее 6 символов"}), 400

    if not current_user.check_password(current_pwd):
        return jsonify({"error": "Неверный текущий пароль"}), 401

    current_user.set_password(new_pwd)
    try:
        from app.core.extensions import db
        db.session.commit()
    except Exception:
        db.session.rollback()
        return jsonify({"error": "Ошибка сервера"}), 500

    return jsonify({"message": "Пароль изменён"}), 200


@auth_bp.route("/recover-account", methods=["POST"])
@rate_limit("auth-recover", limit=3, window_seconds=300)
@csrf_protect
def recover_account():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()

    if not email:
        return jsonify({"error": "Укажите email"}), 400

    user = UserService.get_user_by_email(email)
    if not user:
        return jsonify({"message": "Если аккаунт существует, письмо с инструкциями отправлено на почту."}), 200

    import secrets
    new_password = secrets.token_urlsafe(12)

    user.set_password(new_password)
    try:
        from app.core.extensions import db
        db.session.commit()
    except Exception:
        db.session.rollback()
        return jsonify({"error": "Ошибка сервера"}), 500

    try:
        from app.services.email_service import EmailService
        EmailService.send_system_notification_email(
            user.email,
            user.username,
            f"Восстановление аккаунта\n\nВаш новый пароль: {new_password}\n\nВойдите в аккаунт и смените пароль в настройках."
        )
    except Exception:
        pass

    return jsonify({"message": "Если аккаунт существует, письмо с инструкциями отправлено на почту."}), 200


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
