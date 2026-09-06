"""OAuth 2.0 Authorization Server — Vondic.

Implements Authorization Code Grant and Refresh Token Grant per OAUTH_EN.md.
Codes and tokens are stored in Redis for multi-worker persistence.
"""
import json
import logging
import secrets
import time
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional
from urllib.parse import urlencode

import redis
from fastapi import APIRouter, Depends, Form, HTTPException, Query, Request, status
from fastapi.responses import HTMLResponse, RedirectResponse, JSONResponse
from pydantic import BaseModel
from sqlalchemy import select
from werkzeug.security import check_password_hash

from app.core.deps import get_async_db
from app.core.deps import get_current_user, get_optional_current_user
from app.models.oauth_client import OAuthClient
from app.models.user import User

logger = logging.getLogger(__name__)

oauth_router = APIRouter(prefix="/oauth", tags=["OAuth2"])

# Redis-backed stores (shared across all gunicorn workers)
_redis = redis.Redis(host="redis", port=6379, db=0, decode_responses=True)

OAUTH_CODE_PREFIX = "oauth:code:"       # oauth:code:{code} -> JSON
OAUTH_TOKEN_PREFIX = "oauth:token:"     # oauth:token:{token} -> JSON
REFRESH_TOKEN_PREFIX = "oauth:refresh:" # oauth:refresh:{token} -> JSON
OAUTH_SESSIONS_PREFIX = "oauth:sessions:" # oauth:sessions:{user_id} -> JSON list


def _store_code(code: str, data: dict, ttl: int = 600):
    _redis.setex(OAUTH_CODE_PREFIX + code, ttl, json.dumps(data))


def _pop_code(code: str) -> Optional[dict]:
    key = OAUTH_CODE_PREFIX + code
    raw = _redis.get(key)
    if raw:
        _redis.delete(key)
        return json.loads(raw)
    return None


def _store_token(token: str, data: dict, ttl: int = 3600):
    _redis.setex(OAUTH_TOKEN_PREFIX + token, ttl, json.dumps(data))


def _get_token(token: str) -> Optional[dict]:
    raw = _redis.get(OAUTH_TOKEN_PREFIX + token)
    return json.loads(raw) if raw else None


def _delete_token(token: str):
    _redis.delete(OAUTH_TOKEN_PREFIX + token)


def _store_refresh(token: str, data: dict):
    _redis.setex(REFRESH_TOKEN_PREFIX + token, 86400 * 30, json.dumps(data))  # 30 days


def _pop_refresh(token: str) -> Optional[dict]:
    key = REFRESH_TOKEN_PREFIX + token
    raw = _redis.get(key)
    if raw:
        _redis.delete(key)
        return json.loads(raw)
    return None


def _record_oauth_session(user_id: str, client_id: str, client_name: str):
    """Record an OAuth session for the user's 'Service Access' page."""
    key = OAUTH_SESSIONS_PREFIX + user_id
    sessions = json.loads(_redis.get(key) or "[]")
    # Avoid duplicates
    existing = [s for s in sessions if s.get("client_id") == client_id]
    if not existing:
        sessions.append({
            "client_id": client_id,
            "client_name": client_name,
            "first_access": datetime.utcnow().isoformat(),
            "last_access": datetime.utcnow().isoformat(),
        })
    else:
        existing[0]["last_access"] = datetime.utcnow().isoformat()
    _redis.set(key, json.dumps(sessions))


def _get_oauth_sessions(user_id: str) -> list:
    key = OAUTH_SESSIONS_PREFIX + user_id
    return json.loads(_redis.get(key) or "[]")


def _remove_oauth_session(user_id: str, client_id: str):
    key = OAUTH_SESSIONS_PREFIX + user_id
    sessions = json.loads(_redis.get(key) or "[]")
    sessions = [s for s in sessions if s.get("client_id") != client_id]
    _redis.set(key, json.dumps(sessions))


# ── Schemas ──────────────────────────────────────────────────────────

class OAuthClientCreateSchema(BaseModel):
    name: str
    redirect_uris: str
    description: Optional[str] = None


# ── Helpers ──────────────────────────────────────────────────────────

def _validate_redirect_uri(client: OAuthClient, redirect_uri: str) -> bool:
    """Check that redirect_uri is in the client's allowed list."""
    allowed = [u.strip() for u in (client.redirect_uris or "").split(",") if u.strip()]
    if not allowed:
        return True
    return redirect_uri in allowed


def _error_redirect(redirect_uri: str, error: str, description: str = "", state: str = None) -> RedirectResponse:
    """Build an error redirect per RFC 6749 §4.1.2.1."""
    params: Dict[str, str] = {"error": error}
    if description:
        params["error_description"] = description
    if state:
        params["state"] = state
    sep = "&" if "?" in redirect_uri else "?"
    return RedirectResponse(url=f"{redirect_uri}{sep}{urlencode(params)}", status_code=302)


def _consent_page(client_name: str, client_description: str, client_id: str,
                  redirect_uri: str, scope: str, state: str, username: str,
                  avatar_url: str = None) -> HTMLResponse:
    """Render the OAuth consent page."""
    state_field = f'<input type="hidden" name="state" value="{state}">' if state else ""
    html = f"""<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Vondic — Авторизация</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
  * {{ margin:0; padding:0; box-sizing:border-box; }}
  body {{ font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
         background:#09090b; color:#e4e4e7; display:flex; align-items:center;
         justify-content:center; min-height:100vh; overflow:hidden; }}

  /* Animated gradient background */
  body::before {{ content:''; position:fixed; top:-50%; left:-50%; width:200%; height:200%;
                  background:radial-gradient(circle at 30% 50%, rgba(124,92,255,.08) 0%, transparent 50%),
                             radial-gradient(circle at 70% 50%, rgba(99,102,241,.06) 0%, transparent 50%);
                  animation:bgShift 15s ease-in-out infinite alternate; z-index:0; }}
  @keyframes bgShift {{ 0% {{ transform:translate(0,0) }} 100% {{ transform:translate(-5%,3%) }} }}

  .card {{ position:relative; z-index:1; background:rgba(24,24,27,.85); backdrop-filter:blur(20px);
           border:1px solid rgba(63,63,70,.5); border-radius:20px; padding:48px 40px;
           max-width:460px; width:92%; box-shadow:0 24px 64px rgba(0,0,0,.6),
           0 0 0 1px rgba(255,255,255,.03) inset;
           animation:cardIn .5s cubic-bezier(.16,1,.3,1) both; }}
  @keyframes cardIn {{ from {{ opacity:0; transform:translateY(24px) scale(.97) }} }}

  /* Logo */
  .logo-wrap {{ display:flex; align-items:center; gap:12px; margin-bottom:32px; }}
  .logo-icon {{ width:44px; height:44px; border-radius:12px; overflow:hidden;
                box-shadow:0 4px 16px rgba(124,92,255,.3); flex-shrink:0; }}
  .logo-icon img {{ width:100%; height:100%; object-fit:cover; }}
  .logo-text {{ font-size:24px; font-weight:700; color:#fff; letter-spacing:-.5px; }}
  .logo-badge {{ font-size:11px; font-weight:600; color:#7c5cff; background:rgba(124,92,255,.12);
                  padding:3px 8px; border-radius:6px; letter-spacing:.5px; }}

  /* User info */
  .user-bar {{ display:flex; align-items:center; gap:10px; background:rgba(39,39,42,.6);
               border:1px solid rgba(63,63,70,.4); border-radius:12px; padding:12px 16px;
               margin-bottom:28px; }}
  .user-avatar {{ width:36px; height:36px; border-radius:50%; background:linear-gradient(135deg,#7c5cff,#6366f1);
                  display:flex; align-items:center; justify-content:center; font-size:14px;
                  font-weight:600; color:#fff; flex-shrink:0; overflow:hidden; }}
  .user-avatar img {{ width:100%; height:100%; object-fit:cover; border-radius:50%; }}
  .user-details {{ flex:1; min-width:0; }}
  .user-label {{ font-size:11px; color:#71717a; text-transform:uppercase; letter-spacing:.5px; }}
  .user-name {{ font-size:14px; font-weight:600; color:#fff; white-space:nowrap;
                overflow:hidden; text-overflow:ellipsis; }}

  /* App info */
  .app-section {{ margin-bottom:28px; }}
  .app-name {{ font-size:20px; font-weight:700; color:#fff; margin-bottom:6px; }}
  .app-desc {{ font-size:14px; color:#a1a1aa; line-height:1.5; }}

  /* Permissions */
  .perms {{ background:rgba(39,39,42,.5); border:1px solid rgba(63,63,70,.3);
            border-radius:14px; padding:20px; margin-bottom:32px; }}
  .perms-title {{ font-size:12px; font-weight:600; color:#71717a; text-transform:uppercase;
                  letter-spacing:.8px; margin-bottom:14px; display:flex; align-items:center; gap:8px; }}
  .perms-title::before {{ content:''; width:6px; height:6px; background:#7c5cff; border-radius:50%; }}
  .perm-item {{ display:flex; align-items:center; gap:12px; padding:10px 0;
                border-bottom:1px solid rgba(63,63,70,.2); }}
  .perm-item:last-child {{ border-bottom:none; }}
  .perm-icon {{ width:32px; height:32px; background:rgba(124,92,255,.1); border-radius:8px;
                display:flex; align-items:center; justify-content:center; font-size:15px; flex-shrink:0; }}
  .perm-text {{ font-size:13px; color:#d4d4d8; }}
  .perm-text b {{ color:#fff; font-weight:600; }}

  /* Buttons */
  .btn {{ display:flex; align-items:center; justify-content:center; width:100%; padding:14px;
          border:none; border-radius:12px; font-size:15px; font-weight:600; cursor:pointer;
          transition:all .2s ease; font-family:inherit; }}
  .btn:active {{ transform:scale(.98) }}
  .btn-allow {{ background:linear-gradient(135deg,#7c5cff,#6366f1); color:#fff;
                box-shadow:0 4px 16px rgba(124,92,255,.3); margin-bottom:12px; }}
  .btn-allow:hover {{ box-shadow:0 6px 24px rgba(124,92,255,.45); transform:translateY(-1px) }}
  .btn-deny {{ background:rgba(39,39,42,.6); color:#a1a1aa; border:1px solid rgba(63,63,70,.4); }}
  .btn-deny:hover {{ background:rgba(39,39,42,.9); color:#d4d4d8; }}

  /* Footer */
  .footer {{ margin-top:28px; text-align:center; font-size:11px; color:#52525b; }}
  .footer a {{ color:#7c5cff; text-decoration:none; }}
  .footer a:hover {{ text-decoration:underline; }}

  /* Security notice */
  .security {{ display:flex; align-items:center; gap:8px; margin-top:20px; padding:12px 16px;
               background:rgba(34,197,94,.06); border:1px solid rgba(34,197,94,.15);
               border-radius:10px; font-size:12px; color:#86efac; }}
  .security svg {{ flex-shrink:0; }}
</style>
</head>
<body>
<div class="card">
  <div class="logo-wrap">
    <div class="logo-icon">
      <img src="https://vondic.ru/logo.png" alt="Вондик" onerror="this.parentElement.innerHTML='<div style=\\'width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#7c5cff,#6366f1);font-size:20px;font-weight:700;color:#fff\\'>V</div>'">
    </div>
    <div>
      <div class="logo-text">Вондик</div>
    </div>
    <div class="logo-badge">OAuth 2.0</div>
  </div>

  <div class="user-bar">
    <div class="user-avatar">{f'<img src="{avatar_url}" alt="{username}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">' if avatar_url else username[0].upper() if username else 'U'}</div>
    <div class="user-details">
      <div class="user-label">Вы вошли как</div>
      <div class="user-name">{username}</div>
    </div>
  </div>

  <div class="app-section">
    <div class="app-name">{client_name}</div>
    <div class="app-desc">{client_description or 'Запрашивает доступ к вашему аккаунту'}</div>
  </div>

  <div class="perms">
    <div class="perms-title">Запрашиваемые разрешения</div>
    <div class="perm-item">
      <div class="perm-icon">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#7c5cff" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
      </div>
      <div class="perm-text">Доступ к <b>профилю</b> и основной информации</div>
    </div>
    <div class="perm-item">
      <div class="perm-icon">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#7c5cff" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
      </div>
      <div class="perm-text">Доступ: <b>{scope or 'базовый'}</b></div>
    </div>
  </div>

  <form method="POST" action="/oauth/authorize">
    <input type="hidden" name="client_id" value="{client_id}">
    <input type="hidden" name="redirect_uri" value="{redirect_uri}">
    <input type="hidden" name="scope" value="{scope or ''}">
    <input type="hidden" name="response_type" value="code">
    {state_field}
    <button class="btn btn-allow" name="confirm" value="true" type="submit">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="margin-right:8px"><path d="M20 6L9 17l-5-5"/></svg>
      Разрешить доступ
    </button>
    <button class="btn btn-deny" name="confirm" value="false" type="submit">Отклонить</button>
  </form>

  <div class="security">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
    Безопасное соединение. Вы можете отозвать доступ в любой момент в настройках.
  </div>

  <div class="footer">
    <a href="https://vondic.ru">Вондик</a> &middot; Платформа для общения
  </div>
</div>
</body>
</html>"""
    return HTMLResponse(content=html)


def _unauthorized_modal_page(
    client_name: str,
    client_description: str,
    client_id: str,
    redirect_uri: str,
    scope: str,
    state: str,
) -> HTMLResponse:
    """Render the OAuth authorization page with an auth modal when unauthenticated."""
    sep = "&" if "?" in redirect_uri else "?"
    deny_url = f"{redirect_uri}{sep}error=access_denied"
    if state:
        deny_url += f"&state={state}"

    html = f"""<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Vondic — Авторизация</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
  * {{ margin:0; padding:0; box-sizing:border-box; }}
  body {{ font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
         background:#09090b; color:#e4e4e7; display:flex; align-items:center;
         justify-content:center; min-height:100vh; overflow:hidden; }}

  body::before {{ content:''; position:fixed; top:-50%; left:-50%; width:200%; height:200%;
                  background:radial-gradient(circle at 30% 50%, rgba(124,92,255,.08) 0%, transparent 50%),
                             radial-gradient(circle at 70% 50%, rgba(99,102,241,.06) 0%, transparent 50%);
                  animation:bgShift 15s ease-in-out infinite alternate; z-index:0; }}
  @keyframes bgShift {{ 0% {{ transform:translate(0,0) }} 100% {{ transform:translate(-5%,3%) }} }}

  .card {{ position:relative; z-index:1; background:rgba(24,24,27,.85); backdrop-filter:blur(20px);
           border:1px solid rgba(63,63,70,.5); border-radius:20px; padding:48px 40px;
           max-width:460px; width:92%; box-shadow:0 24px 64px rgba(0,0,0,.6),
           0 0 0 1px rgba(255,255,255,.03) inset;
           animation:cardIn .5s cubic-bezier(.16,1,.3,1) both; }}
  @keyframes cardIn {{ from {{ opacity:0; transform:translateY(24px) scale(.97) }} }}

  .logo-wrap {{ display:flex; align-items:center; gap:12px; margin-bottom:28px; }}
  .logo-icon {{ width:44px; height:44px; border-radius:12px; overflow:hidden;
                box-shadow:0 4px 16px rgba(124,92,255,.3); flex-shrink:0; }}
  .logo-icon img {{ width:100%; height:100%; object-fit:cover; }}
  .logo-text {{ font-size:24px; font-weight:700; color:#fff; letter-spacing:-.5px; }}
  .logo-badge {{ font-size:11px; font-weight:600; color:#7c5cff; background:rgba(124,92,255,.12);
                  padding:3px 8px; border-radius:6px; letter-spacing:.5px; }}

  .app-section {{ margin-bottom:24px; }}
  .app-name {{ font-size:20px; font-weight:700; color:#fff; margin-bottom:6px; }}
  .app-desc {{ font-size:14px; color:#a1a1aa; line-height:1.5; }}

  .perms {{ background:rgba(39,39,42,.5); border:1px solid rgba(63,63,70,.3);
            border-radius:14px; padding:18px; margin-bottom:24px; }}
  .perms-title {{ font-size:12px; font-weight:600; color:#71717a; text-transform:uppercase;
                  letter-spacing:.8px; margin-bottom:12px; display:flex; align-items:center; gap:8px; }}
  .perms-title::before {{ content:''; width:6px; height:6px; background:#7c5cff; border-radius:50%; }}
  .perm-item {{ display:flex; align-items:center; gap:12px; padding:8px 0;
                border-bottom:1px solid rgba(63,63,70,.2); }}
  .perm-item:last-child {{ border-bottom:none; }}
  .perm-icon {{ width:30px; height:30px; background:rgba(124,92,255,.1); border-radius:8px;
                display:flex; align-items:center; justify-content:center; font-size:14px; flex-shrink:0; }}
  .perm-text {{ font-size:13px; color:#d4d4d8; }}
  .perm-text b {{ color:#fff; font-weight:600; }}

  .notice-box {{ background:rgba(124,92,255,.1); border:1px solid rgba(124,92,255,.25);
                 border-radius:12px; padding:14px 16px; margin-bottom:20px; display:flex;
                 align-items:center; gap:12px; }}
  .notice-icon {{ width:32px; height:32px; border-radius:8px; background:rgba(124,92,255,.2);
                  display:flex; align-items:center; justify-content:center; color:#a78bfa; flex-shrink:0; }}
  .notice-title {{ font-size:13px; font-weight:600; color:#fff; }}
  .notice-desc {{ font-size:12px; color:#a1a1aa; margin-top:2px; }}

  .btn {{ display:flex; align-items:center; justify-content:center; width:100%; padding:14px;
          border:none; border-radius:12px; font-size:15px; font-weight:600; cursor:pointer;
          transition:all .2s ease; font-family:inherit; text-decoration:none; }}
  .btn:active {{ transform:scale(.98) }}
  .btn-primary {{ background:linear-gradient(135deg,#7c5cff,#6366f1); color:#fff;
                  box-shadow:0 4px 16px rgba(124,92,255,.3); margin-bottom:12px; }}
  .btn-primary:hover {{ box-shadow:0 6px 24px rgba(124,92,255,.45); transform:translateY(-1px) }}
  .btn-deny {{ background:rgba(39,39,42,.6); color:#a1a1aa; border:1px solid rgba(63,63,70,.4); }}
  .btn-deny:hover {{ background:rgba(39,39,42,.9); color:#d4d4d8; }}

  .footer {{ margin-top:24px; text-align:center; font-size:11px; color:#52525b; }}
  .footer a {{ color:#7c5cff; text-decoration:none; }}
  .footer a:hover {{ text-decoration:underline; }}

  /* Modal Overlay */
  .modal-overlay {{ position:fixed; inset:0; z-index:1000; background:rgba(0,0,0,.75);
                    backdrop-filter:blur(10px); -webkit-backdrop-filter:blur(10px);
                    display:flex; align-items:center; justify-content:center;
                    padding:16px; animation:fadeIn .25s ease-out; }}
  @keyframes fadeIn {{ from {{ opacity:0; }} to {{ opacity:1; }} }}

  .modal-card {{ background:#141417; border:1px solid rgba(255,255,255,.12);
                 border-radius:24px; width:100%; max-width:440px; max-height:92vh;
                 box-shadow:0 24px 64px rgba(0,0,0,.85); display:flex; flex-direction:column;
                 overflow:hidden; animation:scaleIn .3s cubic-bezier(.16,1,.3,1) both; position:relative; }}
  @keyframes scaleIn {{ from {{ opacity:0; transform:scale(.95) translateY(10px); }} }}

  .modal-header {{ display:flex; align-items:center; justify-content:space-between;
                   padding:18px 24px 14px; border-bottom:1px solid rgba(255,255,255,.07); }}
  .modal-title {{ display:flex; align-items:center; gap:10px; font-size:16px; font-weight:600; color:#fff; }}
  .modal-title-icon {{ width:28px; height:28px; border-radius:8px; background:linear-gradient(135deg,#7c5cff,#6366f1);
                       display:flex; align-items:center; justify-content:center; font-weight:700; font-size:14px; color:#fff; }}
  .modal-close {{ width:32px; height:32px; border-radius:8px; border:none; background:rgba(255,255,255,.05);
                  color:#a1a1aa; display:flex; align-items:center; justify-content:center; cursor:pointer;
                  font-size:20px; line-height:1; transition:all .2s ease; }}
  .modal-close:hover {{ background:rgba(255,255,255,.15); color:#fff; }}

  .modal-body {{ padding:0; flex:1; min-height:480px; display:flex; flex-direction:column; }}
  .auth-iframe {{ width:100%; height:520px; border:none; background:transparent; flex:1; }}

  .auth-fallback {{ padding:24px; display:none; flex-direction:column; gap:16px; }}
  .auth-input {{ width:100%; padding:12px 16px; border-radius:12px; background:rgba(255,255,255,.05);
                 border:1px solid rgba(255,255,255,.1); color:#fff; font-size:14px; outline:none; }}
  .auth-input:focus {{ border-color:#7c5cff; }}
  .toggle-fallback {{ text-align:center; font-size:12px; color:#71717a; padding:12px; cursor:pointer; }}
  .toggle-fallback:hover {{ color:#a1a1aa; }}
</style>
</head>
<body>
<div class="card">
  <div class="logo-wrap">
    <div class="logo-icon">
      <img src="https://vondic.ru/logo.png" alt="Вондик" onerror="this.parentElement.innerHTML='<div style=\\'width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#7c5cff,#6366f1);font-size:20px;font-weight:700;color:#fff\\'>V</div>'">
    </div>
    <div>
      <div class="logo-text">Вондик</div>
    </div>
    <div class="logo-badge">OAuth 2.0</div>
  </div>

  <div class="app-section">
    <div class="app-name">{client_name}</div>
    <div class="app-desc">{client_description or 'Запрашивает доступ к вашему аккаунту'}</div>
  </div>

  <div class="perms">
    <div class="perms-title">Запрашиваемые разрешения</div>
    <div class="perm-item">
      <div class="perm-icon">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#7c5cff" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
      </div>
      <div class="perm-text">Доступ к <b>профилю</b> и основной информации</div>
    </div>
    <div class="perm-item">
      <div class="perm-icon">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#7c5cff" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
      </div>
      <div class="perm-text">Доступ: <b>{scope or 'базовый'}</b></div>
    </div>
  </div>

  <div class="notice-box">
    <div class="notice-icon">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>
    </div>
    <div>
      <div class="notice-title">Требуется вход в Vondic</div>
      <div class="notice-desc">Для авторизации приложения войдите в свой аккаунт</div>
    </div>
  </div>

  <button class="btn btn-primary" onclick="openModal()">
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:8px"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>
    Войти в аккаунт
  </button>
  <a class="btn btn-deny" href="{deny_url}">Отклонить</a>

  <div class="footer">
    <a href="https://vondic.ru">Вондик</a> &middot; Платформа для общения
  </div>
</div>

<!-- Modal Dialog for Authorization -->
<div id="auth-modal" class="modal-overlay">
  <div class="modal-card">
    <div class="modal-header">
      <div class="modal-title">
        <div class="modal-title-icon">V</div>
        <span>Авторизация в Vondic</span>
      </div>
      <button class="modal-close" onclick="closeModal()" title="Закрыть">&times;</button>
    </div>
    <div class="modal-body">
      <iframe id="auth-frame" class="auth-iframe" src="/login?modal=1" allow="clipboard-write"></iframe>

      <div id="direct-auth-form" class="auth-fallback">
        <input type="text" id="direct-email" class="auth-input" placeholder="Email или логин">
        <input type="password" id="direct-password" class="auth-input" placeholder="Пароль">
        <div id="direct-error" style="color:#f87171; font-size:13px; display:none;"></div>
        <button class="btn btn-primary" onclick="submitDirectAuth()">Войти</button>
      </div>

      <div class="toggle-fallback" id="toggle-fallback-btn" onclick="toggleFallback()">
        Проблемы с загрузкой? Войти через форму
      </div>
    </div>
  </div>
</div>

<script>
  function openModal() {{
    document.getElementById('auth-modal').style.display = 'flex';
  }}

  function closeModal() {{
    document.getElementById('auth-modal').style.display = 'none';
  }}

  document.getElementById('auth-modal').addEventListener('click', function(e) {{
    if (e.target === this) {{
      closeModal();
    }}
  }});

  document.addEventListener('keydown', function(e) {{
    if (e.key === 'Escape') {{
      closeModal();
    }}
  }});

  function onAuthSuccess() {{
    closeModal();
    window.location.reload();
  }}

  window.addEventListener('message', function(event) {{
    if (event.data && (event.data.type === 'VONDIC_AUTH_SUCCESS' || event.data === 'auth_success')) {{
      onAuthSuccess();
    }}
  }});

  var authCheckInterval = setInterval(function() {{
    fetch('/oauth/me', {{ credentials: 'include' }})
      .then(function(res) {{
        if (res.ok) {{
          clearInterval(authCheckInterval);
          onAuthSuccess();
        }}
      }})
      .catch(function() {{}});
  }}, 2000);

  function toggleFallback() {{
    var iframe = document.getElementById('auth-frame');
    var form = document.getElementById('direct-auth-form');
    var btn = document.getElementById('toggle-fallback-btn');
    if (form.style.display === 'flex') {{
      form.style.display = 'none';
      iframe.style.display = 'block';
      btn.textContent = 'Проблемы с загрузкой? Войти через форму';
    }} else {{
      form.style.display = 'flex';
      iframe.style.display = 'none';
      btn.textContent = 'Вернуться к стандартной форме';
    }}
  }}

  function submitDirectAuth() {{
    var email = document.getElementById('direct-email').value.trim();
    var password = document.getElementById('direct-password').value;
    var errEl = document.getElementById('direct-error');
    errEl.style.display = 'none';

    if (!email || !password) {{
      errEl.textContent = 'Заполните все поля';
      errEl.style.display = 'block';
      return;
    }}

    fetch('/api/v1/auth/login', {{
      method: 'POST',
      headers: {{ 'Content-Type': 'application/json' }},
      credentials: 'include',
      body: JSON.stringify({{ email: email, password: password, device_type: 'web' }})
    }})
    .then(function(r) {{ return r.json(); }})
    .then(function(data) {{
      if (data.access_token) {{
        document.cookie = 'access_token=' + data.access_token + '; path=/; max-age=259200; SameSite=Lax';
        onAuthSuccess();
      }} else if (data.error) {{
        errEl.textContent = data.error;
        errEl.style.display = 'block';
      }} else {{
        errEl.textContent = 'Ошибка входа';
        errEl.style.display = 'block';
      }}
    }})
    .catch(function(err) {{
      errEl.textContent = 'Ошибка соединения';
      errEl.style.display = 'block';
    }});
  }}
</script>
</body>
</html>"""
    return HTMLResponse(content=html)


# ── Authorization Endpoint ───────────────────────────────────────────

@oauth_router.get("/authorize")
async def get_oauth_authorize(
    client_id: str = Query(...),
    redirect_uri: str = Query(...),
    response_type: str = Query("code"),
    scope: Optional[str] = Query(""),
    state: Optional[str] = Query(None),
    current_user=Depends(get_optional_current_user),
    db=Depends(get_async_db),
):
    """Display the OAuth consent page."""
    logger.info("[OAuth] GET /authorize — client_id=%s, redirect_uri=%s, user=%s",
                client_id, redirect_uri, current_user.id if current_user else "anonymous")

    if response_type != "code":
        logger.warning("[OAuth] unsupported_response_type for client_id=%s", client_id)
        return _error_redirect(redirect_uri, "unsupported_response_type",
                               "Only 'code' is supported", state)

    res = await db.execute(select(OAuthClient).where(
        OAuthClient.client_id == client_id, OAuthClient.is_active == 1))
    client = res.scalar_one_or_none()
    if not client:
        logger.warning("[OAuth] invalid_client: client_id=%s not found or inactive", client_id)
        return _error_redirect(redirect_uri, "invalid_client",
                               "Client not found or inactive", state)

    if not _validate_redirect_uri(client, redirect_uri):
        logger.warning("[OAuth] invalid_redirect_uri: %s not in allowed list for client_id=%s",
                       redirect_uri, client_id)
        return _error_redirect(redirect_uri, "invalid_redirect_uri",
                               "Redirect URI not in allowed list", state)

    if not current_user:
        logger.info("[OAuth] User not logged in, showing auth required page with modal")
        return _unauthorized_modal_page(
            client_name=client.name or "Приложение",
            client_description=client.get_public_description() or "",
            client_id=client_id,
            redirect_uri=redirect_uri,
            scope=scope or "",
            state=state or "",
        )

    logger.info("[OAuth] Showing consent page for user=%s, client=%s",
                current_user.id, client.name)
    return _consent_page(
        client_name=client.name or "Приложение",
        client_description=client.get_public_description() or "",
        client_id=client_id,
        redirect_uri=redirect_uri,
        scope=scope or "",
        state=state or "",
        username=current_user.username or current_user.email or "Пользователь",
        avatar_url=getattr(current_user, 'avatar_url', None),
    )


@oauth_router.post("/authorize")
async def post_oauth_authorize(
    request: Request,
    current_user=Depends(get_current_user),
    db=Depends(get_async_db),
):
    """Process the user's allow/deny decision. Redirects to callback."""
    form = await request.form()
    client_id = form.get("client_id", "")
    redirect_uri = form.get("redirect_uri", "")
    scope = form.get("scope", "")
    state = form.get("state", "")
    confirm = form.get("confirm", "true")

    logger.info("[OAuth] POST /authorize — user=%s, client_id=%s, confirm=%s",
                current_user.id, client_id, confirm)

    if confirm == "false":
        logger.info("[OAuth] User %s denied authorization for client_id=%s",
                    current_user.id, client_id)
        return _error_redirect(redirect_uri, "access_denied",
                               "User denied authorization", state)

    res = await db.execute(select(OAuthClient).where(
        OAuthClient.client_id == client_id, OAuthClient.is_active == 1))
    client = res.scalar_one_or_none()
    if not client:
        logger.warning("[OAuth] invalid_client on authorize: client_id=%s", client_id)
        return _error_redirect(redirect_uri, "invalid_client",
                               "Client not found or inactive", state)

    if not _validate_redirect_uri(client, redirect_uri):
        logger.warning("[OAuth] invalid_redirect_uri on authorize: %s", redirect_uri)
        return _error_redirect(redirect_uri, "invalid_redirect_uri",
                               "Redirect URI not in allowed list", state)

    code = f"vdc_{secrets.token_urlsafe(32)}"
    _store_code(code, {
        "user_id": current_user.id,
        "client_id": client_id,
        "redirect_uri": redirect_uri,
        "scope": scope or "basic",
    })

    # Record OAuth session for the user's "Service Access" page
    _record_oauth_session(current_user.id, client_id, client.name or "Приложение")

    logger.info("[OAuth] Authorization code issued for user=%s, client_id=%s, scope=%s",
                current_user.id, client_id, scope or "basic")

    sep = "&" if "?" in redirect_uri else "?"
    callback_url = f"{redirect_uri}{sep}code={code}"
    if state:
        callback_url += f"&state={state}"

    return RedirectResponse(url=callback_url, status_code=302)


# ── Token Endpoint ───────────────────────────────────────────────────

@oauth_router.post("/token")
async def post_oauth_token(request: Request, db=Depends(get_async_db)):
    """Exchange authorization code or refresh token for access token.

    Supports:
      - grant_type=authorization_code
      - grant_type=refresh_token
    """
    form = await request.form()
    grant_type = form.get("grant_type", "authorization_code")
    client_id = form.get("client_id", "")
    client_secret = form.get("client_secret", "")

    # Also accept JSON body
    body = {}
    try:
        body = await request.json()
    except Exception:
        pass

    grant_type = grant_type or body.get("grant_type", "authorization_code")
    client_id = client_id or body.get("client_id", "")
    client_secret = client_secret or body.get("client_secret", "")

    logger.info("[OAuth] POST /token — grant_type=%s, client_id=%s", grant_type, client_id)

    # Verify client credentials
    if client_id and client_secret:
        res = await db.execute(select(OAuthClient).where(
            OAuthClient.client_id == client_id, OAuthClient.is_active == 1))
        client = res.scalar_one_or_none()
        if not client:
            logger.warning("[OAuth] Token request: invalid_client_id=%s", client_id)
            return JSONResponse(status_code=400, content={"error": "invalid_client"})
        if not check_password_hash(client.client_secret_hash, client_secret):
            logger.warning("[OAuth] Token request: invalid_client_secret for client_id=%s", client_id)
            return JSONResponse(status_code=400, content={"error": "invalid_client"})
    else:
        logger.warning("[OAuth] Token request: missing client_id or client_secret")
        return JSONResponse(status_code=400, content={"error": "invalid_client",
                            "error_description": "client_id and client_secret required"})

    if grant_type == "authorization_code":
        code = form.get("code") or body.get("code")
        redirect_uri = form.get("redirect_uri") or body.get("redirect_uri")

        code_info = _pop_code(code) if code else None
        if not code_info:
            logger.warning("[OAuth] Token exchange: invalid or expired code for client_id=%s", client_id)
            return JSONResponse(status_code=400, content={"error": "invalid_grant",
                                "error_description": "Invalid or expired authorization code"})

        if redirect_uri and code_info.get("redirect_uri") != redirect_uri:
            logger.warning("[OAuth] Token exchange: redirect_uri mismatch for client_id=%s", client_id)
            return JSONResponse(status_code=400, content={"error": "invalid_grant",
                                "error_description": "redirect_uri mismatch"})

        user_id = code_info["user_id"]
        access_token = f"vdc_at_{secrets.token_urlsafe(32)}"
        refresh_token = f"vdc_rt_{secrets.token_urlsafe(32)}"

        _store_token(access_token, {
            "user_id": user_id,
            "client_id": client_id,
            "scope": code_info.get("scope", "basic"),
        }, ttl=3600)
        _store_refresh(refresh_token, {
            "user_id": user_id,
            "client_id": client_id,
            "scope": code_info.get("scope", "basic"),
        })

        logger.info("[OAuth] Token issued for user=%s, client_id=%s, scope=%s",
                    user_id, client_id, code_info.get("scope", "basic"))

        return {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "Bearer",
            "expires_in": 3600,
            "scope": code_info.get("scope", ""),
        }

    elif grant_type == "refresh_token":
        refresh_token = form.get("refresh_token") or body.get("refresh_token")

        rt_info = _pop_refresh(refresh_token) if refresh_token else None
        if not rt_info:
            logger.warning("[OAuth] Refresh token: invalid token for client_id=%s", client_id)
            return JSONResponse(status_code=400, content={"error": "invalid_grant",
                                "error_description": "Invalid refresh token"})

        # Issue new token pair
        new_access = f"vdc_at_{secrets.token_urlsafe(32)}"
        new_refresh = f"vdc_rt_{secrets.token_urlsafe(32)}"

        _store_token(new_access, {
            "user_id": rt_info["user_id"],
            "client_id": rt_info["client_id"],
            "scope": rt_info["scope"],
        }, ttl=3600)
        _store_refresh(new_refresh, rt_info)

        logger.info("[OAuth] Token refreshed for user=%s, client_id=%s",
                    rt_info["user_id"], client_id)

        return {
            "access_token": new_access,
            "refresh_token": new_refresh,
            "token_type": "Bearer",
            "expires_in": 3600,
            "scope": rt_info["scope"],
        }

    else:
        logger.warning("[OAuth] Unsupported grant_type: %s", grant_type)
        return JSONResponse(status_code=400, content={"error": "unsupported_grant_type",
                            "error_description": f"Grant type '{grant_type}' not supported"})


# ── Userinfo Endpoint ────────────────────────────────────────────────

@oauth_router.get("/userinfo")
@oauth_router.get("/me")
async def get_oauth_userinfo(
    request: Request,
    access_token: Optional[str] = Query(None),
    db=Depends(get_async_db),
):
    """Get current user info (per OAUTH_EN.md spec)."""
    token = access_token
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.split(" ", 1)[1]

    token_info = _get_token(token) if token else None
    if not token_info:
        logger.warning("[OAuth] GET /userinfo — invalid or missing token")
        return JSONResponse(status_code=401, content={"error": "invalid_token",
                            "error_description": "Token is invalid or expired"})

    logger.info("[OAuth] GET /userinfo — user=%s, client_id=%s",
                token_info["user_id"], token_info.get("client_id"))

    res = await db.execute(select(User).where(User.id == token_info["user_id"]))
    user = res.scalar_one_or_none()
    if not user:
        logger.warning("[OAuth] GET /userinfo — user_not_found: %s", token_info["user_id"])
        return JSONResponse(status_code=404, content={"error": "user_not_found"})

    return {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "role": getattr(user, "role", "User"),
        "status": getattr(user, "status", "offline"),
        "balance": getattr(user, "balance", 0),
        "premium": getattr(user, "premium", 0),
        "disk_usage": getattr(user, "disk_usage", 0),
        "disk_limit": getattr(user, "disk_limit", 1073741824),
        "avatar_url": getattr(user, "avatar_url", None),
        "first_name": getattr(user, "first_name", None),
        "last_name": getattr(user, "last_name", None),
    }


# ── Client Management ────────────────────────────────────────────────

@oauth_router.post("/clients", status_code=status.HTTP_201_CREATED)
async def create_oauth_client(
    payload: OAuthClientCreateSchema,
    current_user=Depends(get_current_user),
    db=Depends(get_async_db),
):
    client_id = OAuthClient.generate_client_id()
    client_secret = OAuthClient.generate_client_secret()

    client = OAuthClient(
        id=str(uuid.uuid4()),
        user_id=current_user.id,
        client_id=client_id,
        client_secret_plain=client_secret,
        name=payload.name,
        description=payload.description,
        redirect_uris=payload.redirect_uris,
    )
    client.set_client_secret(client_secret)
    db.add(client)
    await db.commit()

    return {"client": client.to_dict(), "client_secret": client_secret}


@oauth_router.get("/clients")
async def list_oauth_clients(
    current_user=Depends(get_current_user),
    db=Depends(get_async_db),
):
    res = await db.execute(select(OAuthClient).where(OAuthClient.user_id == current_user.id))
    clients = res.scalars().all()
    return {"clients": [c.to_dict() for c in clients]}


@oauth_router.put("/clients/{client_id}")
async def update_oauth_client(
    client_id: str,
    payload: dict,
    current_user=Depends(get_current_user),
    db=Depends(get_async_db),
):
    res = await db.execute(select(OAuthClient).where(
        OAuthClient.client_id == client_id, OAuthClient.user_id == current_user.id))
    client = res.scalar_one_or_none()
    if not client:
        raise HTTPException(status_code=404, detail="OAuth client not found")

    if "name" in payload:
        client.name = payload["name"]
    if "redirect_uris" in payload:
        uris = payload["redirect_uris"]
        client.redirect_uris = ",".join(uris) if isinstance(uris, list) else str(uris)
    if "verified" in payload and getattr(current_user, "role", "").lower() in ("admin",):
        client.verified = 1 if payload["verified"] else 0
    if "description" in payload or "logo_url" in payload or "default_scopes" in payload:
        _, cur_logo, cur_scopes = client._parse_description()
        cur_text = client.get_public_description()
        client.set_description_fields(
            text=payload.get("description", cur_text),
            logo_url=payload.get("logo_url", cur_logo),
            default_scopes=payload.get("default_scopes", cur_scopes),
        )
    if "is_active" in payload:
        client.is_active = 1 if payload["is_active"] else 0

    await db.commit()
    await db.refresh(client)
    return client.to_dict()


@oauth_router.delete("/clients/{client_id}")
async def delete_oauth_client(
    client_id: str,
    current_user=Depends(get_current_user),
    db=Depends(get_async_db),
):
    res = await db.execute(select(OAuthClient).where(
        OAuthClient.client_id == client_id, OAuthClient.user_id == current_user.id))
    client = res.scalar_one_or_none()
    if not client:
        raise HTTPException(status_code=404, detail="OAuth client not found")

    await db.delete(client)
    await db.commit()
    return {"message": "Client deleted successfully"}


# ── Service Access (Доступ к сервисам) ───────────────────────────────

@oauth_router.get("/sessions")
async def list_oauth_sessions(
    current_user=Depends(get_current_user),
):
    """List all OAuth services the user has authorized.

    Returns a list of services (OAuth clients) the user has logged into
    via OAuth, with first/last access timestamps.
    """
    sessions = _get_oauth_sessions(current_user.id)
    return {"sessions": sessions}


@oauth_router.delete("/sessions/{client_id}")
async def revoke_oauth_session(
    client_id: str,
    current_user=Depends(get_current_user),
    db=Depends(get_async_db),
):
    """Revoke access for an OAuth service.

    Removes the session record and invalidates all active tokens for this client.
    """
    # Remove from session list
    _remove_oauth_session(current_user.id, client_id)

    # Invalidate all tokens for this user+client
    # Scan Redis for matching tokens
    cursor = 0
    deleted = 0
    while True:
        cursor, keys = _redis.scan(cursor, match=OAUTH_TOKEN_PREFIX + "*", count=100)
        for key in keys:
            raw = _redis.get(key)
            if raw:
                data = json.loads(raw)
                if data.get("user_id") == current_user.id and data.get("client_id") == client_id:
                    _redis.delete(key)
                    deleted += 1
        if cursor == 0:
            break

    logger.info("[OAuth] Revoked session for user=%s, client_id=%s, tokens_deleted=%d",
                current_user.id, client_id, deleted)

    return {"ok": True, "revoked": client_id, "tokens_deleted": deleted}
