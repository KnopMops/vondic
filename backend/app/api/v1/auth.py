import hashlib
import json
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional
from urllib.parse import parse_qs, urlencode, urlparse, urlunparse

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_async_session
from app.core.deps import get_current_user, get_optional_current_user
from app.models.user import User
from app.schemas.user_schema import UserLoginSchema, UserRegisterSchema
from app.services.auth_service import AuthService
from app.services.user_service import UserService

auth_router = APIRouter(prefix="/api/v1/auth", tags=["Auth"])

desktop_yandex_sessions: Dict[str, dict] = {}


def _get_client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    real_ip = request.headers.get("x-real-ip")
    if real_ip:
        return real_ip.strip()
    return request.client.host if request.client else ""


@auth_router.post("/register", status_code=status.HTTP_201_CREATED)
async def register(
    payload: UserRegisterSchema,
    request: Request,
    db: AsyncSession = Depends(get_async_session),
):
    ip = _get_client_ip(request)
    data = payload.model_dump()
    data["ip_address"] = ip

    user, error = await AuthService.register_user_async(data, db=db, ip_address=ip)
    if error:
        raise HTTPException(status_code=400, detail=error)

    return {
        "message": "Пользователь зарегистрирован. Пожалуйста, проверьте свою почту для подтверждения.",
        "user": user.to_dict(),
        "access_token": user.access_token,
        "refresh_token": user.refresh_token,
    }


@auth_router.post("/login")
async def login(
    payload: Dict[str, Any],
    request: Request,
    db: AsyncSession = Depends(get_async_session),
):
    ip = _get_client_ip(request)
    result, error = await AuthService.login_user_async(payload, db=db, ip_address=ip)

    if error:
        if error in ("TwoFactorEmailRequired", "TwoFactorTotpRequired"):
            return Response(
                content=json.dumps({"two_factor_required": True, "method": "email"}),
                status_code=401,
                media_type="application/json",
            )
        raise HTTPException(status_code=401 if "Invalid" in error else 400, detail=error)

    user = result["user"]
    return {
        "message": "Вход выполнен успешно",
        "access_token": result["access_token"],
        "refresh_token": result["refresh_token"],
        "user": user.to_dict(),
    }


@auth_router.post("/check-email")
async def check_email(
    payload: Dict[str, Any],
    db: AsyncSession = Depends(get_async_session),
):
    raw = payload.get("email", "")
    email, err = AuthService._validate_registration_email(raw)
    if err:
        return {"valid": False, "available": False, "error": err}

    stmt = select(User).where(User.email == email)
    res = await db.execute(stmt)
    exists = bool(res.scalars().first())

    return {
        "valid": True,
        "available": not exists,
        "email": email,
    }


@auth_router.post("/refresh")
async def refresh_session(
    request: Request,
    payload: Optional[Dict[str, Any]] = None,
    db: AsyncSession = Depends(get_async_session),
):
    token = None
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        token = auth_header.split(" ", 1)[1].strip()

    if not token and payload:
        token = payload.get("refresh_token")

    if not token:
        raise HTTPException(status_code=400, detail="Требуется refresh_token")

    ip = _get_client_ip(request)
    result, error = await AuthService.refresh_with_refresh_token_async(token, db=db, ip_address=ip)
    if error:
        raise HTTPException(status_code=401, detail=error)

    return {
        "message": "Токены обновлены",
        "access_token": result["access_token"],
        "refresh_token": result["refresh_token"],
        "user": result["user"].to_dict(),
    }


@auth_router.get("/me")
@auth_router.post("/me")
async def me(
    current_user: User = Depends(get_current_user),
):
    return {
        "message": "Пользователь авторизован",
        "is_authenticated": True,
        "user": current_user.to_dict(),
    }


@auth_router.post("/forgot-password")
async def forgot_password(
    payload: Dict[str, Any],
    db: AsyncSession = Depends(get_async_session),
):
    email = payload.get("email")
    if not email:
        raise HTTPException(status_code=400, detail="Укажите email")

    success, message = await AuthService.request_password_reset_async(email, db=db)
    if not success:
        raise HTTPException(status_code=400, detail=message)
    return {"message": message}


@auth_router.post("/reset-password")
async def reset_password_route(
    payload: Dict[str, Any],
    db: AsyncSession = Depends(get_async_session),
):
    token = payload.get("token")
    new_password = payload.get("new_password") or payload.get("password")
    if not token or not new_password:
        raise HTTPException(status_code=400, detail="Токен и новый пароль обязательны")

    success, message = await AuthService.reset_password_async(token, new_password, db=db)
    if not success:
        raise HTTPException(status_code=400, detail=message)
    return {"message": message}


@auth_router.get("/verify-email/{token}")
async def verify_email(
    token: str,
    db: AsyncSession = Depends(get_async_session),
):
    success, message = await AuthService.verify_email_async(token, db=db)
    if not success:
        raise HTTPException(status_code=400, detail=message)
    return {"message": message}


@auth_router.post("/verify-password")
async def verify_password(
    payload: Dict[str, Any],
    current_user: User = Depends(get_current_user),
):
    password = (payload.get("password") or "").strip()
    if not password:
        raise HTTPException(status_code=400, detail="Password required")
    if not current_user.check_password(password):
        raise HTTPException(status_code=401, detail="Invalid password")
    return {"success": True}


@auth_router.post("/change-password")
async def change_password(
    payload: Dict[str, Any],
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session),
):
    current_pwd = (payload.get("current_password") or "").strip()
    new_pwd = (payload.get("new_password") or "").strip()

    if not current_pwd or not new_pwd:
        raise HTTPException(status_code=400, detail="Текущий и новый пароль обязательны")
    if len(new_pwd) < 6:
        raise HTTPException(status_code=400, detail="Пароль должен быть не менее 6 символов")
    if not current_user.check_password(current_pwd):
        raise HTTPException(status_code=401, detail="Неверный текущий пароль")

    current_user.set_password(new_pwd)
    await db.commit()
    return {"message": "Пароль изменён"}

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


@auth_bp.route("/device-sessions", methods=["GET"])
@token_required
def list_device_sessions(current_user):
    from app.models.user_session import UserSession
    token = _extract_access_token()
    current_lookup = token.split(".")[0] if token and "." in token else (token or "")
    sessions = UserSession.query.filter_by(user_id=current_user.id).order_by(UserSession.last_active.desc()).all()
    result = []
    for s in sessions:
        d = s.to_dict()
        d["is_current"] = (s.access_token_lookup == current_lookup)
        result.append(d)
    return jsonify({
        "sessions": result,
    })


@auth_bp.route("/device-sessions/<session_id>", methods=["DELETE"])
@token_required
def delete_device_session(current_user, session_id):
    from app.models.user_session import UserSession
    token = _extract_access_token()
    current_lookup = token.split(".")[0] if token and "." in token else (token or "")
    session = UserSession.query.filter_by(id=session_id, user_id=current_user.id).first()
    if not session:
        return jsonify({"error": "Сессия не найдена"}), 404
    if session.access_token_lookup == current_lookup:
        return jsonify({"error": "Нельзя завершить текущую сессию"}), 400
    if session.device_type == "mobile":
        return jsonify({"error": "Сессия мобильного приложения не может быть завершена с сайта"}), 403
    db.session.delete(session)
    db.session.commit()
    return jsonify({"ok": True})


_QR_SESSION_PREFIX = "qr_session:"
_QR_SESSION_TTL = 300  # 5 минут


@auth_bp.route("/qr/generate", methods=["POST"])
def qr_generate():
    import secrets
    qr_token = secrets.token_urlsafe(32)
    cache.set(
        f"{_QR_SESSION_PREFIX}{qr_token}",
        {"status": "pending"},
        timeout=_QR_SESSION_TTL,
    )
    return jsonify({"qr_token": qr_token})


@auth_bp.route("/qr/status", methods=["GET"])
def qr_status():
    qr_token = request.args.get("qr_token", "")
    key = f"{_QR_SESSION_PREFIX}{qr_token}"
    session = cache.get(key)
    if not session:
        return jsonify({"status": "expired"}), 200
    if session["status"] == "confirmed":
        result = {
            "status": "confirmed",
            "access_token": session.get("access_token"),
            "refresh_token": session.get("refresh_token"),
            "user": session.get("user"),
        }
        cache.delete(key)
        return jsonify(result), 200
    if session["status"] == "cancelled":
        cache.delete(key)
        return jsonify({"status": "cancelled"}), 200
    return jsonify({"status": "pending"}), 200


@auth_bp.route("/qr/scan", methods=["POST"])
@token_required
def qr_scan(current_user):
    data = request.get_json(silent=True) or {}
    qr_token = data.get("qr_token", "")
    if not qr_token:
        return jsonify({"error": "Требуется qr_token"}), 400
    key = f"{_QR_SESSION_PREFIX}{qr_token}"
    session = cache.get(key)
    if not session:
        return jsonify({"error": "QR код не найден или истёк"}), 404
    if session["status"] != "pending":
        return jsonify({"error": "QR код уже использован"}), 400
    device_type = (data.get("device_type") or "mobile").strip().lower()
    if device_type not in ("web", "mobile", "desktop"):
        device_type = "mobile"
    raw_access, raw_refresh = AuthService._issue_tokens(
        current_user, device_type, f"QR login from {device_type}",
        ip_address=_get_client_ip()
    )
    try:
        db.session.commit()
    except Exception:
        db.session.rollback()
        return jsonify({"error": "Ошибка сервера"}), 500
    cache.set(
        key,
        {
            "status": "confirmed",
            "access_token": raw_access,
            "refresh_token": raw_refresh,
            "user": user_schema.dump(current_user),
        },
        timeout=_QR_SESSION_TTL,
    )
    return jsonify({"ok": True})


@auth_bp.route("/yandex/link", methods=["GET"])
@token_required
def yandex_link(current_user):
    state = f"link:{current_user.id}"
    client_id = Config.YANDEX_CLIENT_ID
    redirect_uri = Config.YANDEX_LINK_REDIRECT_URI or Config.YANDEX_REDIRECT_URI
    if not client_id or not redirect_uri:
        return jsonify({"error": "Yandex OAuth не настроен"}), 500

    params = {
        "response_type": "code",
        "client_id": client_id,
        "redirect_uri": redirect_uri,
        "force_confirm": "yes",
        "state": state,
    }
    auth_url = f"https://oauth.yandex.ru/authorize?{urlencode(params)}"
    return jsonify({"auth_url": auth_url}), 200


@auth_bp.route("/yandex/link-callback", methods=["GET"])
@token_required
def yandex_link_callback(current_user):
    code = request.args.get("code")
    state = request.args.get("state", "")

    if not code:
        return jsonify({"error": "Не所提供之 код"}), 400

    if not state.startswith("link:"):
        return jsonify({"error": "Неверный state"}), 400

    state_user_id = state.split(":", 1)[1]
    if state_user_id != current_user.id:
        return jsonify({"error": "Неверный пользователь"}), 403


    client_id = Config.YANDEX_CLIENT_ID
    client_secret = Config.YANDEX_CLIENT_SECRET
    redirect_uri = Config.YANDEX_LINK_REDIRECT_URI or Config.YANDEX_REDIRECT_URI

    token_url = "https://oauth.yandex.ru/token"
    data = {
        "grant_type": "authorization_code",
        "code": code,
        "client_id": client_id,
        "client_secret": client_secret,
        "redirect_uri": redirect_uri,
    }

    try:
        response = requests.post(token_url, data=data)
        response.raise_for_status()
        token_data = response.json()
        access_token_yandex = token_data.get("access_token")
    except Exception as e:
        return jsonify({"error": f"Failed to get token: {str(e)}"}), 500

    info_url = "https://login.yandex.ru/info"
    headers = {"Authorization": f"OAuth {access_token_yandex}"}

    try:
        info_response = requests.get(info_url, headers=headers)
        info_response.raise_for_status()
        user_info = info_response.json()
    except Exception as e:
        return jsonify({"error": f"Failed to get user info: {str(e)}"}), 500

    new_yandex_id = str(user_info.get("id"))

    existing = User.query.filter(
        User.yandex_id == new_yandex_id,
        User.id != current_user.id,
    ).first()
    if existing:
        return jsonify({"error": "Этот Yandex аккаунт уже привязан к другому пользователю"}), 400

    current_user.yandex_id = new_yandex_id
    current_user.yandex_token = access_token_yandex
    db.session.commit()

    return jsonify({"ok": True, "yandex_id": new_yandex_id, "yandex_disk_connected": True}), 200


@auth_bp.route("/yandex/unlink", methods=["DELETE"])
@token_required
def yandex_unlink(current_user):
    if not current_user.yandex_id:
        return jsonify({"error": "Yandex аккаунт не привязан"}), 400

    if current_user.email and current_user.email.endswith("@yandex.ru"):
        return jsonify({"error": "Невозможно отвязать Yandex от аккаунта, созданного через Yandex OAuth"}), 400

    current_user.yandex_id = None
    current_user.yandex_token = None
    db.session.commit()

    return jsonify({"ok": True}), 200
