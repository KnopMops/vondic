import uuid
from html import escape
from datetime import datetime, timedelta
from urllib.parse import quote, urlencode, urlparse, urlunparse

from flask import Blueprint, jsonify, make_response, redirect, request, url_for
from sqlalchemy import TEXT, INTEGER, TIMESTAMP
from sqlalchemy import func

from app.core.config import Config
from app.core.extensions import db
from app.models.oauth_client import OAuthClient
from app.models.user import User
from app.utils.decorators import token_required

oauth_bp = Blueprint("oauth", __name__, url_prefix="/oauth")


def _redirect_uri_match_key(uri: str) -> str:
    """Treat http://localhost and http://127.0.0.1 as the same redirect (dev ergonomics)."""
    u = (uri or "").strip()
    if not u:
        return u
    try:
        parsed = urlparse(u)
        if parsed.scheme != "http":
            return u
        host = (parsed.hostname or "").lower()
        if host not in ("127.0.0.1", "localhost"):
            return u
        netloc = f"127.0.0.1:{parsed.port}" if parsed.port else "127.0.0.1"
        return urlunparse(
            (
                parsed.scheme,
                netloc,
                parsed.path,
                parsed.params,
                parsed.query,
                parsed.fragment,
            )
        )
    except Exception:
        return u


def _redirect_uri_is_allowed(requested: str, allowed_csv: str) -> bool:
    allowed = [
        uri.strip() for uri in (allowed_csv or "").split(",") if uri.strip()
    ]
    if not allowed:
        return False
    key = _redirect_uri_match_key(requested)
    allowed_keys = {_redirect_uri_match_key(u) for u in allowed}
    return key in allowed_keys


def _redirect_uri_pair_matches(stored: str, provided: str) -> bool:
    return _redirect_uri_match_key(stored) == _redirect_uri_match_key(provided)


def _oauth_authorize_path(
    client_id: str,
    redirect_uri: str,
    response_type: str,
    scope: str,
    state: str,
) -> str:
    q = urlencode(
        {
            "client_id": client_id,
            "redirect_uri": redirect_uri,
            "response_type": response_type,
            "scope": scope,
            "state": state,
        }
    )
    return f"/oauth/authorize?{q}"


def _frontend_login_for_oauth(authorize_path: str, pick_account: bool = False) -> str:
    base = (Config.FRONTEND_URL or "http://localhost:3000").rstrip("/")
    suffix = "&pick_account=1" if pick_account else ""
    return f"{base}/login?redirect={quote(authorize_path, safe='')}{suffix}"


def _handle_oauth_redirect(redirect_url: str):
    if redirect_url.startswith("http://") or redirect_url.startswith("https://"):
        return redirect(redirect_url)

    import json
    from html import escape

    is_error = "error=" in redirect_url
    if is_error:
        icon_html = """
        <div class="icon-container error">
            <svg class="icon-cross" viewBox="0 0 24 24">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
        </div>
        """
        title = "В доступе отказано"
        subtitle = "Вы отклонили запрос на авторизацию. Возвращаем вас в мобильное приложение Вондик. Если перенаправление не произошло, нажмите кнопку ниже."
        accent_btn_class = "btn-deny-accent"
        extra_css = """
        .icon-container.error {
            background: rgba(239, 68, 68, 0.1);
            border-color: rgba(239, 68, 68, 0.2);
            animation: pulse-error 2s infinite;
        }
        .icon-cross {
            width: 32px;
            height: 32px;
            fill: none;
            stroke: #ef4444;
            stroke-width: 3;
            stroke-linecap: round;
            stroke-linejoin: round;
            stroke-dasharray: 100;
            stroke-dashoffset: 100;
            animation: drawCross 0.4s ease-out 0.2s forwards;
        }
        @keyframes drawCross {
            to { stroke-dashoffset: 0; }
        }
        @keyframes pulse-error {
            0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); }
            70% { box-shadow: 0 0 0 12px rgba(239, 68, 68, 0); }
            100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
        }
        .btn-deny-accent {
            background: rgba(255,255,255,0.06);
            border: 1px solid rgba(255,255,255,0.12);
            color: var(--text);
            box-shadow: none;
        }
        .btn-deny-accent:hover {
            background: rgba(255,255,255,0.1);
            box-shadow: none;
            transform: translateY(-1px);
        }
        """
    else:
        icon_html = """
        <div class="icon-container">
            <svg class="icon-checkmark" viewBox="0 0 24 24">
                <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
        </div>
        """
        title = "Авторизация успешна"
        subtitle = "Возвращаем вас в мобильное приложение Вондик. Если перенаправление не произошло автоматически, нажмите кнопку ниже."
        accent_btn_class = ""
        extra_css = ""

    safe_url = escape(redirect_url)
    redirect_url_json = json.dumps(redirect_url)
    
    return f"""<!doctype html>
<html lang="ru">
<head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{escape(title)} — Вондик</title>
    <style>
        :root {{
            color-scheme: dark;
            --bg: #070b14;
            --card: rgba(19, 26, 41, 0.92);
            --text: #e5e7eb;
            --muted: #9ca3af;
            --accent: #6366f1;
            --accent-2: #8b5cf6;
            --success: #10b981;
            --border: rgba(255,255,255,0.14);
        }}
        * {{ box-sizing: border-box; }}
        body {{
            margin: 0;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            background: radial-gradient(1200px 500px at 20% 10%, rgba(99,102,241,0.15), transparent 60%),
                        radial-gradient(1000px 500px at 80% 85%, rgba(139,92,246,0.12), transparent 60%),
                        var(--bg);
            color: var(--text);
            font-family: Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
            padding: 16px;
        }}
        .card {{
            width: min(420px, 100%);
            border: 1px solid var(--border);
            background: var(--card);
            border-radius: 20px;
            padding: 30px;
            backdrop-filter: blur(8px);
            box-shadow: 0 20px 50px rgba(0,0,0,0.5);
            text-align: center;
            animation: fadeIn 0.4s ease-out;
        }}
        @keyframes fadeIn {{
            from {{ opacity: 0; transform: scale(0.96); }}
            to {{ opacity: 1; transform: scale(1); }}
        }}
        .icon-container {{
            width: 72px;
            height: 72px;
            margin: 0 auto 20px;
            border-radius: 50%;
            background: rgba(16, 185, 129, 0.1);
            border: 2px solid rgba(16, 185, 129, 0.2);
            display: flex;
            align-items: center;
            justify-content: center;
            position: relative;
            animation: pulse 2s infinite;
        }}
        @keyframes pulse {{
            0% {{ box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.4); }}
            70% {{ box-shadow: 0 0 0 12px rgba(16, 185, 129, 0); }}
            100% {{ box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }}
        }}
        .icon-checkmark {{
            width: 32px;
            height: 32px;
            fill: none;
            stroke: var(--success);
            stroke-width: 3;
            stroke-linecap: round;
            stroke-linejoin: round;
            stroke-dasharray: 100;
            stroke-dashoffset: 100;
            animation: drawCheck 0.6s ease-out 0.2s forwards;
        }}
        @keyframes drawCheck {{
            to {{ stroke-dashoffset: 0; }}
        }}
        .title {{ font-size: 20px; margin: 0 0 10px; font-weight: 700; }}
        .subtitle {{ margin: 0 0 24px; color: var(--muted); font-size: 14px; line-height: 1.5; }}
        .btn {{
            display: block;
            width: 100%;
            border: none;
            border-radius: 12px;
            cursor: pointer;
            font-weight: 700;
            font-size: 15px;
            padding: 12px;
            text-decoration: none;
            color: white;
            background: linear-gradient(135deg, var(--accent), var(--accent-2));
            box-shadow: 0 4px 15px rgba(99,102,241,0.35);
            transition: all 0.2s ease;
        }}
        .btn:hover {{
            transform: translateY(-1px);
            box-shadow: 0 6px 20px rgba(99,102,241,0.45);
        }}
        .btn:active {{
            transform: translateY(1px);
        }}
        .hint {{ margin-top: 16px; font-size: 12px; color: var(--muted); }}
        {extra_css}
    </style>
</head>
<body>
    <div class="card">
        {icon_html}
        <h1 class="title">{escape(title)}</h1>
        <p class="subtitle">{escape(subtitle)}</p>
        <a id="redirect-btn" class="btn {accent_btn_class}" href="{safe_url}">Вернуться в приложение</a>
        <p class="hint">{escape(redirect_url.split('?')[0])}</p>
    </div>
    <script>
        const redirectUrl = {redirect_url_json};
        // Attempt automatic redirect
        window.location.href = redirectUrl;
    </script>
</body>
</html>"""



class OAuthAuthorizationCode(db.Model):
    __tablename__ = "oauth_authorization_codes"

    id = db.Column(TEXT, primary_key=True, default=lambda: str(uuid.uuid4()))
    code = db.Column(TEXT, unique=True, nullable=False)
    client_id = db.Column(TEXT, nullable=False)
    user_id = db.Column(TEXT, nullable=False)
    redirect_uri = db.Column(TEXT, nullable=False)
    expires_at = db.Column(TIMESTAMP, nullable=False)
    scope = db.Column(TEXT, default="")
    used = db.Column(INTEGER, default=0)

    def is_expired(self):
        return datetime.utcnow() > self.expires_at


class OAuthAccessToken(db.Model):
    __tablename__ = "oauth_access_tokens"

    id = db.Column(TEXT, primary_key=True, default=lambda: str(uuid.uuid4()))
    token = db.Column(TEXT, unique=True, nullable=False)
    client_id = db.Column(TEXT, nullable=False)
    user_id = db.Column(TEXT, nullable=False)
    expires_at = db.Column(TIMESTAMP, nullable=False)
    scope = db.Column(TEXT, default="")

    def is_expired(self):
        return datetime.utcnow() > self.expires_at


@oauth_bp.route("/authorize", methods=["GET", "POST"])
def authorize():
    from app.services.auth_service import AuthService

    client_id = request.args.get("client_id") or request.form.get("client_id")
    redirect_uri = request.args.get(
        "redirect_uri") or request.form.get("redirect_uri")
    response_type = request.args.get("response_type", "code")
    scope = request.args.get("scope", "") or request.form.get("scope", "")
    state = request.args.get("state", "") or request.form.get("state", "")

    if not client_id or not redirect_uri:
        return jsonify({"error": "invalid_request"}), 400

    if response_type != "code":
        return jsonify({"error": "unsupported_response_type"}), 400

    client = OAuthClient.query.filter_by(
        client_id=client_id, is_active=1).first()
    if not client:
        return jsonify({"error": "invalid_client"}), 401

    if not _redirect_uri_is_allowed(redirect_uri, client.redirect_uris):
        return jsonify({"error": "invalid_redirect_uri"}), 400
    if not scope:
        scope = " ".join(client.get_default_scopes() or [])

    auth_header = request.headers.get("Authorization", "")
    token = None
    if auth_header.startswith("Bearer "):
        token = auth_header.split(" ", 1)[1].strip()

    if not token:
        token = request.args.get("access_token")
    if not token:
        token = request.form.get("access_token")
    if not token:
        token = request.cookies.get("access_token")

    user = None
    if token:
        user, error = AuthService.get_user_by_token(token)
        if not user:
            token = None
    if not token and request.method == "POST" and request.form.get(
            "action") == "login":
        login_data = {
            "email": (request.form.get("email") or "").strip(),
            "password": request.form.get("password") or "",
        }
        result, error = AuthService.login_user(login_data)
        if result:
            token = result["access_token"]
            user = result["user"]
            q = urlencode(
                {
                    "client_id": client_id,
                    "redirect_uri": redirect_uri,
                    "response_type": "code",
                    "scope": scope,
                    "state": state,
                }
            )
            response = make_response(redirect(f"/oauth/authorize?{q}"))
            response.set_cookie(
                "access_token",
                token,
                max_age=30 * 24 * 60 * 60,
                httponly=True,
                samesite="Lax",
            )
            return response
        login_error = escape(error or "Ошибка входа")
        return f"""
        <!doctype html>
        <html lang="ru">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>Вход в Вондик OAuth</title>
          <style>
            body {{ margin:0; min-height:100vh; display:flex; align-items:center; justify-content:center; background:#070b14; color:#e5e7eb; font-family:Inter,system-ui,sans-serif; padding:16px; }}
            .card {{ width:min(460px,100%); border:1px solid rgba(255,255,255,0.14); border-radius:16px; background:rgba(19,26,41,0.92); padding:20px; }}
            .label {{ font-size:13px; color:#9ca3af; margin-bottom:6px; display:block; }}
            .input {{ width:100%; border:1px solid rgba(255,255,255,0.16); background:rgba(255,255,255,0.03); color:#e5e7eb; border-radius:10px; padding:10px 12px; margin-bottom:12px; }}
            .btn {{ width:100%; border:none; border-radius:10px; padding:11px 12px; color:white; cursor:pointer; font-weight:700; background:linear-gradient(135deg, #6366f1, #8b5cf6); }}
            .err {{ margin-bottom:12px; font-size:13px; color:#fca5a5; }}
          </style>
        </head>
        <body>
          <form class="card" method="POST">
            <h1 style="margin:0 0 8px;font-size:22px;">Вход в Вондик</h1>
            <p style="margin:0 0 16px;color:#9ca3af;">Авторизуйтесь, чтобы продолжить OAuth-подключение.</p>
            <div class="err">{login_error}</div>
            <input type="hidden" name="action" value="login" />
            <input type="hidden" name="client_id" value="{escape(client_id)}" />
            <input type="hidden" name="redirect_uri" value="{escape(redirect_uri)}" />
            <input type="hidden" name="scope" value="{escape(scope)}" />
            <input type="hidden" name="state" value="{escape(state)}" />
            <label class="label">Email</label>
            <input class="input" type="email" name="email" required />
            <label class="label">Пароль</label>
            <input class="input" type="password" name="password" required />
            <button class="btn" type="submit">Войти и продолжить</button>
          </form>
        </body>
        </html>
        """, 401
    if not token and request.method == "GET":
        authorize_path = _oauth_authorize_path(
            client_id, redirect_uri, response_type, scope, state
        )
        return redirect(_frontend_login_for_oauth(authorize_path))
    if not token:
        return jsonify({"error": "unauthorized",
                        "message": "User authentication required"}), 401

    if request.method == "GET":

        app_name = escape(client.name or "OAuth приложение")
        app_desc = (client.get_public_description()
                    or "Приложение запрашивает доступ к вашему аккаунту Вондик.")
        app_desc = escape(app_desc)
        safe_redirect_uri = escape(redirect_uri)
        scopes = [s.strip() for s in (scope or "").split(" ") if s.strip()]
        if not scopes:
            scopes = ["basic_profile"]
        scope_labels = {
            "basic_profile": "Базовый профиль",
            "read_profile": "Чтение профиля",
            "read_posts": "Чтение постов",
            "write_posts": "Публикация и изменение постов",
            "read_messages": "Чтение сообщений",
            "write_messages": "Отправка сообщений",
        }
        scopes_html = "".join(
            [
                f'<li style="margin-bottom:6px;"><span style="color:#a5b4fc;">•</span> {
                    escape(
                        scope_labels.get(
                            s,
                            s))} <span style="color:#94a3b8;">({
                    escape(s)})</span></li>' for s in scopes])
        app_initial = (app_name[:1] or "V").upper()
        logo_url = (
            client.get_logo_url() or "").replace(
            '"',
            "").replace(
            "<",
            "").replace(
                ">",
            "")
        logo_html = (
            f'<img src="{logo_url}" alt="logo" style="width:42px;height:42px;border-radius:12px;object-fit:cover;border:1px solid rgba(255,255,255,0.22);" />'
            if logo_url
            else f'<div class="logo">{app_initial}</div>'
        )
        vu = getattr(user, "username", "") or ""
        ve = getattr(user, "email", "") or ""
        vid = getattr(user, "id", "") or ""
        vu_e, ve_e = escape(str(vu)), escape(str(ve))
        vid_e = escape(str(vid))
        account_main = vu_e or ve_e or vid_e or "—"
        account_sub = ""
        if vu_e and ve_e:
            account_sub = f'<div class="value" style="margin-top:6px;color:var(--muted);font-size:13px;">{ve_e}</div>'
        elif ve_e and not vu_e and vid_e:
            account_sub = f'<div class="value" style="margin-top:6px;color:var(--muted);font-size:13px;">ID: {vid_e}</div>'
        user_avatar_raw = (
            getattr(
                user,
                "avatar_url",
                "") or "").replace(
            '"',
            "").replace(
                "<",
                "").replace(
                    ">",
            "").strip()
        user_avatar_html = (
            '<img src="'
            + escape(user_avatar_raw)
            + '" alt="" style="width:42px;height:42px;border-radius:12px;object-fit:cover;border:1px solid rgba(255,255,255,0.22);flex-shrink:0;" />'
            if user_avatar_raw
            else ""
        )
        return f"""
        <!doctype html>
        <html lang="ru">
        <head>
            <meta charset="utf-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1" />
            <title>Вондик OAuth — подтверждение доступа</title>
            <style>
                :root {{
                    color-scheme: dark;
                    --bg: #070b14;
                    --card: rgba(19, 26, 41, 0.92);
                    --text: #e5e7eb;
                    --muted: #9ca3af;
                    --accent: #6366f1;
                    --accent-2: #8b5cf6;
                    --border: rgba(255,255,255,0.14);
                }}
                * {{ box-sizing: border-box; }}
                body {{
                    margin: 0;
                    min-height: 100vh;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: radial-gradient(1200px 500px at 20% 10%, rgba(99,102,241,0.18), transparent 60%),
                                radial-gradient(1000px 500px at 80% 85%, rgba(139,92,246,0.14), transparent 60%),
                                var(--bg);
                    color: var(--text);
                    font-family: Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
                    padding: 16px;
                }}
                .card {{
                    width: min(560px, 100%);
                    border: 1px solid var(--border);
                    background: var(--card);
                    border-radius: 18px;
                    padding: 22px;
                    backdrop-filter: blur(8px);
                    box-shadow: 0 18px 46px rgba(0,0,0,0.45);
                }}
                .title {{ font-size: 24px; margin: 0 0 8px; font-weight: 700; }}
                .subtitle {{ margin: 0 0 18px; color: var(--muted); }}
                .app-head {{
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    margin-bottom: 12px;
                }}
                .logo {{
                    width: 42px;
                    height: 42px;
                    border-radius: 12px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-weight: 800;
                    background: linear-gradient(135deg, var(--accent), var(--accent-2));
                    color: white;
                    border: 1px solid rgba(255,255,255,0.22);
                }}
                .box {{
                    border: 1px solid var(--border);
                    background: rgba(255,255,255,0.03);
                    border-radius: 12px;
                    padding: 12px;
                    margin-bottom: 12px;
                }}
                .label {{ color: var(--muted); font-size: 12px; margin-bottom: 4px; }}
                .value {{ font-size: 14px; word-break: break-word; }}
                .actions {{ display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 14px; }}
                .btn {{
                    border: 1px solid var(--border);
                    border-radius: 12px;
                    cursor: pointer;
                    font-weight: 600;
                    font-size: 14px;
                    padding: 11px 12px;
                }}
                .btn-allow {{
                    border-color: rgba(99,102,241,0.45);
                    color: white;
                    background: linear-gradient(135deg, var(--accent), var(--accent-2));
                }}
                .btn-deny {{
                    background: rgba(255,255,255,0.03);
                    color: var(--text);
                }}
                .hint {{ margin-top: 12px; font-size: 12px; color: var(--muted); }}
                .back-link {{
                    display: inline-block;
                    margin-top: 10px;
                    color: #c7d2fe;
                    text-decoration: none;
                    font-size: 13px;
                }}
                .back-link:hover {{ text-decoration: underline; }}
            </style>
        </head>
        <body>
            <div class="card">
                <h1 class="title">Подтверждение доступа</h1>
                <p class="subtitle">Приложение запрашивает доступ к вашему аккаунту Вондик.</p>
                <div class="box" style="border-color: rgba(99,102,241,0.35); margin-bottom: 14px;">
                    <div class="label">Вы разрешаете доступ от имени аккаунта</div>
                    <div style="display:flex;align-items:center;gap:12px;margin-top:8px;">
                        {user_avatar_html}
                        <div>
                            <div class="value" style="font-size:16px;font-weight:650;">{account_main}</div>
                            {account_sub}
                        </div>
                    </div>
                </div>
                <div class="app-head">
                    {logo_html}
                    <div>
                        <div class="label">Название приложения</div>
                        <div class="value" style="font-size:16px;font-weight:700;">{app_name}</div>
                    </div>
                </div>
                <div class="box">
                    <div class="label">Описание</div>
                    <div class="value">{app_desc}</div>
                </div>
                <div class="box">
                    <div class="label">Redirect URI</div>
                    <div class="value">{safe_redirect_uri}</div>
                </div>
                <div class="box">
                    <div class="label">Запрошенные права</div>
                    <ul style="margin:8px 0 0;padding-left:0;list-style:none;color:#d1d5db;font-size:14px;">
                        {scopes_html}
                    </ul>
                </div>
                <form method="POST">
                    <input type="hidden" name="client_id" value="{escape(client_id)}">
                    <input type="hidden" name="redirect_uri" value="{escape(redirect_uri)}">
                    <input type="hidden" name="state" value="{escape(state)}">
                    <div class="actions">
                        <button class="btn btn-allow" type="submit" name="action" value="allow">Разрешить</button>
                        <button class="btn btn-deny" type="submit" name="action" value="deny">Отказать</button>
                    </div>
                </form>
                <p class="hint">Нажимая "Разрешить", вы предоставляете приложению доступ к данным вашего аккаунта.</p>
                <a class="back-link" href="{escape(_frontend_login_for_oauth(_oauth_authorize_path(client_id, redirect_uri, response_type, scope, state), pick_account=True))}">Выбрать другой аккаунт</a>
                <a class="back-link" href="{safe_redirect_uri}" style="margin-left:12px;">Назад в приложение</a>
            </div>
        </body>
        </html>
        """

    action = request.form.get("action")
    if action == "deny":
        return _handle_oauth_redirect(f"{redirect_uri}?error=access_denied&state={state}")

    code = str(uuid.uuid4())
    expires_at = datetime.utcnow() + timedelta(minutes=10)

    auth_code = OAuthAuthorizationCode(
        code=code,
        client_id=client_id,
        user_id=str(user.id),
        redirect_uri=redirect_uri,
        expires_at=expires_at,
        scope=scope
    )
    db.session.add(auth_code)
    db.session.commit()

    redirect_url = f"{redirect_uri}?code={code}"
    if state:
        redirect_url += f"&state={state}"

    return _handle_oauth_redirect(redirect_url)


@oauth_bp.route("/token", methods=["POST"])
def token():
    grant_type = request.form.get("grant_type")
    client_id = request.form.get("client_id")
    client_secret = request.form.get("client_secret")
    code = request.form.get("code")
    redirect_uri = request.form.get("redirect_uri")
    refresh_token = request.form.get("refresh_token")

    if grant_type == "authorization_code":

        client = OAuthClient.query.filter_by(
            client_id=client_id, is_active=1
        ).first()

        if not client or not client.check_client_secret(client_secret):
            return jsonify({"error": "invalid_client"}), 401

        auth_code = OAuthAuthorizationCode.query.filter_by(
            code=code, client_id=client_id, used=0
        ).first()

        if (not auth_code or auth_code.is_expired() or not _redirect_uri_pair_matches(
                auth_code.redirect_uri, redirect_uri or "")):
            return jsonify({"error": "invalid_grant"}), 400

        auth_code.used = 1

        access_token = str(uuid.uuid4())
        expires_at = datetime.utcnow() + timedelta(hours=1)

        token_obj = OAuthAccessToken(
            token=access_token,
            client_id=client_id,
            user_id=auth_code.user_id,
            expires_at=expires_at,
            scope=auth_code.scope
        )
        db.session.add(token_obj)
        db.session.commit()

        return jsonify({
            "access_token": access_token,
            "token_type": "Bearer",
            "expires_in": 3600,
            "scope": auth_code.scope
        })

    elif grant_type == "refresh_token":

        client = OAuthClient.query.filter_by(
            client_id=client_id, is_active=1
        ).first()

        if not client or not client.check_client_secret(client_secret):
            return jsonify({"error": "invalid_client"}), 401

        old_token = OAuthAccessToken.query.filter_by(
            token=refresh_token, client_id=client_id
        ).first()

        if not old_token or old_token.is_expired():
            return jsonify({"error": "invalid_grant"}), 400

        access_token = str(uuid.uuid4())
        expires_at = datetime.utcnow() + timedelta(hours=1)

        token_obj = OAuthAccessToken(
            token=access_token,
            client_id=client_id,
            user_id=old_token.user_id,
            expires_at=expires_at,
            scope=old_token.scope
        )
        db.session.add(token_obj)
        db.session.delete(old_token)
        db.session.commit()

        return jsonify({
            "access_token": access_token,
            "token_type": "Bearer",
            "expires_in": 3600,
            "scope": old_token.scope
        })

    return jsonify({"error": "unsupported_grant_type"}), 400


@oauth_bp.route("/userinfo", methods=["GET"])
def userinfo():
    auth_header = request.headers.get("Authorization", "")
    token = None
    if auth_header.startswith("Bearer "):
        token = auth_header.replace("Bearer ", "").strip()

    if not token:
        return jsonify({"error": "invalid_request"}), 400

    token_obj = OAuthAccessToken.query.filter_by(token=token).first()
    if not token_obj or token_obj.is_expired():
        return jsonify({"error": "invalid_token"}), 401

    client = OAuthClient.query.filter_by(
        client_id=token_obj.client_id, is_active=1
    ).first()
    if not client:
        return jsonify({"error": "invalid_token"}), 401

    user = User.query.get(token_obj.user_id)
    if not user:
        return jsonify({"error": "user_not_found"}), 404

    return jsonify(user.to_dict())


@oauth_bp.route("/clients", methods=["GET"])
@token_required
def list_oauth_clients(current_user):
    """List OAuth clients for the current user."""
    clients = OAuthClient.query.filter_by(
        user_id=str(current_user.id), is_active=1).all()
    return jsonify([client.to_dict() for client in clients])


@oauth_bp.route("/clients", methods=["POST"])
@token_required
def create_oauth_client(current_user):
    """Create a new OAuth client."""
    data = request.get_json()
    name = data.get("name")
    description = data.get("description", "")
    redirect_uris = data.get("redirect_uris", [])
    logo_url = (data.get("logo_url") or "").strip()
    default_scopes = data.get("default_scopes", [])

    if not name:
        return jsonify({"error": "name_required"}), 400
    if not redirect_uris or not isinstance(redirect_uris, list):
        return jsonify({"error": "redirect_uris_required"}), 400

    client_id = OAuthClient.generate_client_id()
    client_secret = OAuthClient.generate_client_secret()

    client = OAuthClient(
        user_id=str(current_user.id),
        client_id=client_id,
        name=name,
        description="",
        redirect_uris=",".join(redirect_uris)
    )
    if not isinstance(default_scopes, list):
        default_scopes = []
    client.set_description_fields(
        text=description,
        logo_url=logo_url,
        default_scopes=default_scopes,
    )
    client.set_client_secret(client_secret)
    client.client_secret_plain = client_secret

    db.session.add(client)
    db.session.commit()

    result = client.to_dict()
    return jsonify(result), 201


@oauth_bp.route("/clients/<client_id>", methods=["DELETE"])
@token_required
def delete_oauth_client(current_user, client_id):
    """Delete an OAuth client and revoke all its tokens."""
    client = OAuthClient.query.filter_by(
        client_id=client_id, user_id=str(current_user.id)
    ).first()

    if not client:
        return jsonify({"error": "client_not_found"}), 404

    client.is_active = 0
    OAuthAccessToken.query.filter_by(client_id=client_id).delete()
    OAuthAuthorizationCode.query.filter_by(client_id=client_id).delete()
    db.session.commit()

    return jsonify({"message": "deleted"}), 200


@oauth_bp.route("/clients/<client_id>", methods=["PUT"])
@token_required
def update_oauth_client(current_user, client_id):
    """Update OAuth client settings (name, description, redirect_uris)."""
    client = OAuthClient.query.filter_by(
        client_id=client_id, user_id=str(current_user.id), is_active=1
    ).first()
    if not client:
        return jsonify({"error": "client_not_found"}), 404

    data = request.get_json() or {}
    name = (data.get("name") or "").strip()
    description = data.get("description")
    logo_url = data.get("logo_url")
    default_scopes = data.get("default_scopes")
    redirect_uris = data.get("redirect_uris")

    if name:
        client.name = name
    current_text = client.get_public_description()
    current_logo = client.get_logo_url()
    current_scopes = client.get_default_scopes()
    if description is not None:
        current_text = description
    if logo_url is not None:
        current_logo = str(logo_url).strip()
    if default_scopes is not None:
        if not isinstance(default_scopes, list):
            return jsonify({"error": "default_scopes_must_be_array"}), 400
        current_scopes = [str(s).strip()
                          for s in default_scopes if str(s).strip()]
    client.set_description_fields(
        text=current_text,
        logo_url=current_logo,
        default_scopes=current_scopes,
    )
    if redirect_uris is not None:
        if not isinstance(redirect_uris, list):
            return jsonify({"error": "redirect_uris_must_be_array"}), 400
        cleaned = [str(uri).strip()
                   for uri in redirect_uris if str(uri).strip()]
        if not cleaned:
            return jsonify({"error": "redirect_uris_required"}), 400
        client.redirect_uris = ",".join(cleaned)

    db.session.commit()
    return jsonify(client.to_dict()), 200
