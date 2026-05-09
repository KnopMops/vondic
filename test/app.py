import os
import secrets
from typing import Optional, Any, Dict
from urllib.parse import urlencode, urlparse

import requests
from flask import Flask, jsonify, redirect, render_template, request, session, url_for


def _split_host_port(netloc: str) -> tuple[str, Optional[int]]:
    netloc = netloc.strip().lower()
    if ":" in netloc:
        host, _, port_s = netloc.rpartition(":")
        if port_s.isdigit():
            return host, int(port_s)
    return netloc, None


def _loopback_hosts_mismatch(request_host: str, canonical_netloc: str) -> bool:
    """True if same port but localhost vs 127.0.0.1 (different cookie jars)."""
    if not canonical_netloc:
        return False
    rh, rp = _split_host_port(request_host)
    ch, cp = _split_host_port(canonical_netloc)
    if rp != cp:
        return False
    loop = {"127.0.0.1", "localhost"}
    if rh not in loop or ch not in loop:
        return False
    return rh != ch


def _userinfo_identity_for_session(userinfo: Any) -> Optional[Dict[str, Any]]:
    if not isinstance(userinfo, dict):
        return None
    if userinfo.get("error"):
        return None
    uid = userinfo.get("id") or userinfo.get("user_id")
    username = userinfo.get("username") or userinfo.get("login")
    email = userinfo.get("email") or userinfo.get("mail")
    if not any((uid, username, email)):
        return None
    return {
        "id": uid,
        "username": username,
        "email": email,
        "avatar_url": userinfo.get("avatar_url"),
    }


def create_app() -> Flask:
    app = Flask(__name__)
    app.secret_key = os.getenv("FLASK_SECRET_KEY", secrets.token_hex(32))

    app.config["VONDIC_AUTHORIZE_URL"] = os.getenv(
        "VONDIC_AUTHORIZE_URL", "https://vondic.knopusmedia.ru/oauth/authorize"
    )
    app.config["VONDIC_TOKEN_URL"] = os.getenv(
        "VONDIC_TOKEN_URL", "https://vondic.knopusmedia.ru/oauth/token"
    )
    app.config["VONDIC_USERINFO_URL"] = os.getenv(
        "VONDIC_USERINFO_URL", "https://vondic.knopusmedia.ru/oauth/userinfo"
    )
    app.config["VONDIC_CLIENT_ID"] = os.getenv("VONDIC_CLIENT_ID", "")
    app.config["VONDIC_CLIENT_SECRET"] = os.getenv("VONDIC_CLIENT_SECRET", "")
    app.config["VONDIC_REDIRECT_URI"] = os.getenv(
        "VONDIC_REDIRECT_URI", "http://127.0.0.1:5055/auth/callback"
    )

    redirect_netloc = urlparse(app.config["VONDIC_REDIRECT_URI"]).netloc

    @app.before_request
    def _align_loopback_hostname_with_redirect():
        """localhost vs 127.0.0.1 создают разные cookie jars — принудительно как в redirect_uri."""
        if (
            request.method not in {"GET", "HEAD"}
            or not redirect_netloc
            or request.host.lower() == redirect_netloc.lower()
        ):
            return None
        if not _loopback_hosts_mismatch(request.host, redirect_netloc):
            return None
        qs = ""
        if request.query_string:
            qs = "?" + request.query_string.decode()
        base = (
            urlparse(app.config["VONDIC_REDIRECT_URI"]).scheme
            if urlparse(app.config["VONDIC_REDIRECT_URI"]).scheme
            else request.scheme or "http"
        )
        return redirect(
            f"{base}://{redirect_netloc}{request.path}{qs}", code=307)

    @app.get("/")
    def index():
        oauth_user = session.get("oauth_user")
        return render_template(
            "index.html",
            authorize_url=app.config["VONDIC_AUTHORIZE_URL"],
            redirect_uri=app.config["VONDIC_REDIRECT_URI"],
            client_id=app.config["VONDIC_CLIENT_ID"],
            oauth_user=oauth_user,
        )

    @app.get("/auth/start")
    def auth_start():
        if not app.config["VONDIC_CLIENT_ID"]:
            return "Missing VONDIC_CLIENT_ID in environment", 500
        state = secrets.token_urlsafe(24)
        session["oauth_state"] = state
        query = urlencode(
            {
                "client_id": app.config["VONDIC_CLIENT_ID"],
                "redirect_uri": app.config["VONDIC_REDIRECT_URI"],
                "response_type": "code",
                "state": state,
            }
        )
        return redirect(f"{app.config['VONDIC_AUTHORIZE_URL']}?{query}")

    @app.get("/auth/callback")
    def auth_callback():
        code = request.args.get("code")
        state = request.args.get("state")
        error = request.args.get("error")
        expected_state = session.get("oauth_state")
        state_ok = bool(state and expected_state and state == expected_state)
        session.pop("oauth_state", None)
        return render_template(
            "callback.html",
            code=code,
            state=state,
            error=error,
            state_ok=state_ok,
        )

    @app.post("/auth/exchange")
    def auth_exchange():
        payload = request.get_json(silent=True) or {}
        code = payload.get("code")
        state = payload.get("state")
        if not code:
            return jsonify({"error": "code is required"}), 400
        if not state:
            return jsonify({"error": "state is required"}), 400
        if not app.config["VONDIC_CLIENT_SECRET"]:
            return jsonify({"error": "Missing VONDIC_CLIENT_SECRET"}), 500

        token_resp = requests.post(
            app.config["VONDIC_TOKEN_URL"],
            data={
                "grant_type": "authorization_code",
                "code": code,
                "redirect_uri": app.config["VONDIC_REDIRECT_URI"],
                "client_id": app.config["VONDIC_CLIENT_ID"],
                "client_secret": app.config["VONDIC_CLIENT_SECRET"],
            },
            timeout=20,
        )
        token_json = token_resp.json() if token_resp.content else {}
        if token_resp.status_code >= 400:
            return (
                jsonify(
                    {
                        "error": "token_exchange_failed",
                        "status": token_resp.status_code,
                        "details": token_json,
                    }
                ),
                400,
            )

        access_token = token_json.get("access_token")
        userinfo = None
        if access_token:
            me_resp = requests.get(
                app.config["VONDIC_USERINFO_URL"],
                headers={"Authorization": f"Bearer {access_token}"},
                timeout=20,
            )
            userinfo = (
                me_resp.json()
                if me_resp.content
                else {"status": me_resp.status_code}
            )
        else:
            userinfo = {"error": "missing_access_token", "token": token_json}

        stored = _userinfo_identity_for_session(userinfo)
        if stored:
            session["oauth_user"] = stored
            session.modified = True

        return jsonify(
            {
                "token": token_json,
                "userinfo": userinfo,
                "stored_user": stored,
            }
        )

    @app.get("/auth/me")
    def auth_me():
        return jsonify({"user": session.get("oauth_user")})

    @app.get("/auth/debug-session")
    def auth_debug_session():
        return jsonify(
            {
                "has_oauth_user": bool(session.get("oauth_user")),
                "oauth_user": session.get("oauth_user"),
                "oauth_state_present": bool(session.get("oauth_state")),
                "session_keys": sorted(list(session.keys())),
            }
        )

    @app.post("/auth/logout")
    def auth_logout():
        session.pop("oauth_user", None)
        prefers_json = (
            request.accept_mimetypes.best_match(["application/json"])
            == "application/json"
        )
        if prefers_json:
            return jsonify({"ok": True})
        return redirect(url_for("index"))

    return app


if __name__ == "__main__":
    application = create_app()
    application.run(host="127.0.0.1", port=5055, debug=True)
