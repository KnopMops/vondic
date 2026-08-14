import hashlib
import json
import secrets
import uuid
import requests
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional
from urllib.parse import parse_qs, urlencode, urlparse, urlunparse

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_async_session
from app.core.deps import get_current_user, get_optional_current_user
from app.models.user import User
from app.models.user_session import UserSession
from app.schemas.user_schema import UserLoginSchema, UserRegisterSchema
from app.services.auth_service import AuthService
from app.services.user_service import UserService

auth_router = APIRouter(prefix="/api/v1/auth", tags=["Auth"])

desktop_yandex_sessions: Dict[str, dict] = {}
_QR_SESSION_PREFIX = "qr_session:"
_QR_SESSION_TTL = 300  # 5 minutes


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


@auth_router.post("/sessions/terminate")
async def terminate_session(
    payload: Dict[str, Any],
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session),
):
    session_id = payload.get("session_id")
    if not session_id:
        raise HTTPException(status_code=400, detail="Требуется session_id")

    res = await db.execute(
        select(UserSession).where(UserSession.id == session_id, UserSession.user_id == current_user.id)
    )
    sess = res.scalar_one_or_none()
    if not sess:
        raise HTTPException(status_code=404, detail="Сессия не найдена")

    await db.delete(sess)
    await db.commit()
    return {"message": "Сессия завершена", "ok": True}


@auth_router.post("/api-key-login")
async def api_key_login(
    payload: Dict[str, Any],
    request: Request,
    db: AsyncSession = Depends(get_async_session),
):
    api_key = payload.get("api_key")
    cloud_password = payload.get("cloud_password")
    if not api_key:
        raise HTTPException(status_code=400, detail="Требуется api_key")

    user = UserService.get_user_by_api_key(api_key)
    if not user:
        raise HTTPException(status_code=401, detail="Неверный api_key")

    if cloud_password:
        error_msg = UserService.set_or_reset_cloud_password(user, cloud_password)
        if error_msg:
            raise HTTPException(status_code=400, detail=error_msg)

    ip = _get_client_ip(request)
    tokens, error = await AuthService.login_user_async({"email": user.email}, db=db, ip_address=ip)
    if error or not tokens:
        raise HTTPException(status_code=400, detail=error or "Failed to login with API key")

    return {
        "message": "Вход выполнен успешно",
        "access_token": tokens["access_token"],
        "refresh_token": tokens["refresh_token"],
        "user": user.to_dict(),
    }


@auth_router.get("/device-sessions")
async def list_device_sessions(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session),
):
    res = await db.execute(
        select(UserSession)
        .where(UserSession.user_id == current_user.id)
        .order_by(UserSession.last_active.desc())
    )
    sessions = res.scalars().all()
    return {"sessions": [s.to_dict() for s in sessions]}


@auth_router.delete("/device-sessions/{session_id}")
async def delete_device_session(
    session_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session),
):
    res = await db.execute(
        select(UserSession).where(UserSession.id == session_id, UserSession.user_id == current_user.id)
    )
    session = res.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Сессия не найдена")

    if session.device_type == "mobile":
        raise HTTPException(status_code=403, detail="Сессия мобильного приложения не может быть завершена с сайта")

    await db.delete(session)
    await db.commit()
    return {"ok": True}


@auth_router.post("/qr/generate")
async def qr_generate():
    qr_token = secrets.token_urlsafe(32)
    return {"qr_token": qr_token}


@auth_router.get("/qr/status")
async def qr_status(qr_token: str = Query("")):
    return {"status": "pending"}


@auth_router.post("/qr/scan")
async def qr_scan(
    payload: Dict[str, Any],
    current_user: User = Depends(get_current_user),
):
    return {"ok": True}


@auth_router.get("/yandex/login")
@auth_router.post("/yandex/login")
async def yandex_login(
    login_hint: Optional[str] = Query(None),
    request: Request = None,
):
    url, error = AuthService.get_yandex_auth_url(login_hint=login_hint)
    if error or not url:
        raise HTTPException(status_code=500, detail=error or "Yandex OAuth не настроен")
    return {"auth_url": url}


@auth_router.get("/yandex/callback")
@auth_router.post("/yandex/callback")
async def yandex_callback(
    code: Optional[str] = Query(None),
    payload: Optional[Dict[str, Any]] = None,
    request: Request = None,
):
    auth_code = code
    if not auth_code and payload:
        auth_code = payload.get("code")

    if not auth_code:
        raise HTTPException(status_code=400, detail="Требуется код авторизации")

    ip = _get_client_ip(request) if request else None
    result, error = AuthService.login_yandex_user(auth_code, ip_address=ip)
    if error or not result:
        raise HTTPException(status_code=400, detail=error or "Ошибка авторизации через Yandex")

    return {
        "message": "Вход через Yandex выполнен успешно",
        "access_token": result["access_token"],
        "refresh_token": result["refresh_token"],
        "user": result["user"].to_dict(),
    }


@auth_router.get("/yandex/link")
async def yandex_link(
    current_user: User = Depends(get_current_user),
):
    state = f"link:{current_user.id}"
    client_id = getattr(settings, "YANDEX_CLIENT_ID", "")
    redirect_uri = getattr(settings, "YANDEX_REDIRECT_URI", "")
    if not client_id or not redirect_uri:
        raise HTTPException(status_code=500, detail="Yandex OAuth не настроен")

    params = {
        "response_type": "code",
        "client_id": client_id,
        "redirect_uri": redirect_uri,
        "force_confirm": "yes",
        "state": state,
    }
    auth_url = f"https://oauth.yandex.ru/authorize?{urlencode(params)}"
    return {"auth_url": auth_url}


@auth_router.get("/yandex/link-callback")
async def yandex_link_callback(
    code: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session),
):
    if not code:
        raise HTTPException(status_code=400, detail="Authorization code is required")

    client_id = getattr(settings, "YANDEX_CLIENT_ID", "")
    client_secret = getattr(settings, "YANDEX_CLIENT_SECRET", "")
    redirect_uri = getattr(settings, "YANDEX_REDIRECT_URI", "")

    if not client_id or not client_secret:
        raise HTTPException(status_code=500, detail="Yandex OAuth не настроен")

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
        raise HTTPException(status_code=500, detail=f"Failed to get token: {str(e)}")

    info_url = "https://login.yandex.ru/info"
    headers = {"Authorization": f"OAuth {access_token_yandex}"}

    try:
        info_response = requests.get(info_url, headers=headers)
        info_response.raise_for_status()
        user_info = info_response.json()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get user info: {str(e)}")

    new_yandex_id = str(user_info.get("id"))

    stmt = select(User).where(User.yandex_id == new_yandex_id, User.id != current_user.id)
    res = await db.execute(stmt)
    if res.scalars().first():
        raise HTTPException(status_code=400, detail="Этот Yandex аккаунт уже привязан к другому пользователю")

    current_user.yandex_id = new_yandex_id
    current_user.yandex_token = access_token_yandex
    await db.commit()

    return {"ok": True, "yandex_id": new_yandex_id, "yandex_disk_connected": True}


@auth_router.delete("/yandex/unlink")
async def yandex_unlink(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session),
):
    if not current_user.yandex_id:
        raise HTTPException(status_code=400, detail="Yandex аккаунт не привязан")

    if current_user.email and current_user.email.endswith("@yandex.ru"):
        raise HTTPException(
            status_code=400, detail="Невозможно отвязать Yandex от аккаунта, созданного через Yandex OAuth")

    current_user.yandex_id = None
    current_user.yandex_token = None
    await db.commit()
    return {"ok": True}
