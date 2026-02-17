from app.schemas.user_schema import user_schema
from app.services.auth_service import AuthService
from app.services.user_service import UserService
from app.utils.decorators import rate_limit, token_required
from flask import Blueprint, current_app, jsonify, request
from itsdangerous import URLSafeTimedSerializer

auth_bp = Blueprint("auth", __name__, url_prefix="/api/v1/auth")


@auth_bp.route("/register", methods=["POST"])
@rate_limit("auth-register", limit=5, window_seconds=60)
def register():
    data = request.get_json()
    if not data:
        return (jsonify({"error": "No data provided"}), 400)
    user, error = AuthService.register_user(data)
    if error:
        return (jsonify({"error": error}), 400)
    return (
        jsonify(
            {
                "message": "User registered successfully. Please check your email to verify account.",
                "user": user_schema.dump(user),
                "access_token": user.access_token,
                "refresh_token": user.refresh_token,
            }
        ),
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
    data = request.get_json()
    if not data:
        return (jsonify({"error": "No data provided"}), 400)
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
            return jsonify({"two_factor_required": True, "method": "email"}), 401
        if error == "TwoFactorTotpRequired":
            return jsonify({"two_factor_required": True, "method": "totp"}), 401
        status_code = (
            401
            if error
            in ["Invalid email or password", "User is blocked", "Email not verified", "InvalidTwoFactorCode"]
            else 400
        )
        return (jsonify({"error": error}), status_code)
    return (
        jsonify(
            {
                "message": "Login successful",
                "access_token": result["access_token"],
                "refresh_token": result["refresh_token"],
                "user": user_schema.dump(result["user"]),
            }
        ),
        200,
    )


@auth_bp.route("/telegram/link", methods=["POST"])
def link_telegram_account():
    data = request.get_json() or {}
    link_key = data.get("link_key")
    telegram_id = data.get("telegram_id")

    if not link_key or not telegram_id:
        return jsonify({"error": "Missing link_key or telegram_id"}), 400

    user, error = AuthService.link_telegram(link_key, telegram_id)
    if error:
        return jsonify({"error": error}), 400

    return jsonify({"message": "Account linked successfully", "user": user_schema.dump(user)}), 200


@auth_bp.route("/me", methods=["POST"])
def me():
    data = request.get_json() or {}
    token = data.get("access_token")

    if not token:
        return jsonify({"error": "access_token is required"}), 400

    user, error = AuthService.get_user_by_token(token)

    if error:
        return jsonify({"error": error, "is_authenticated": False}), 401

    return (
        jsonify(
            {
                "message": "User is authenticated",
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
    auth_url, error = AuthService.get_yandex_auth_url()
    if error:
        return jsonify({"error": error}), 400
    return jsonify({"auth_url": auth_url}), 200


@auth_bp.route("/yandex/callback", methods=["GET"])
def yandex_callback():
    code = request.args.get("code")
    if not code:
        return jsonify({"error": "No code provided"}), 400

    result, error = AuthService.login_yandex_user(code)
    if error:
        return jsonify({"error": error}), 400

    return (
        jsonify(
            {
                "message": "Login successful",
                "access_token": result["access_token"],
                "refresh_token": result["refresh_token"],
                "user": user_schema.dump(result["user"]),
            }
        ),
        200,
    )


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
            return jsonify({
                "message": "Code generated (dev)",
                "dev_code": current_user.two_factor_email_code
            }), 200
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
    return jsonify({"message": "2FA email code verified"}), 200


@auth_bp.route("/login-alerts/toggle", methods=["POST"])
@token_required
def toggle_login_alerts(current_user):
    data = request.get_json() or {}
    enable = bool(data.get("enable", True))
    success, error = AuthService.toggle_login_alerts(current_user, enable)
    if not success:
        return jsonify({"error": error}), 400
    return jsonify({"message": "Login alerts updated"}), 200


@auth_bp.route("/telegram-login", methods=["POST"])
@rate_limit("auth-telegram-login", limit=10, window_seconds=60)
def telegram_login():
    data = request.get_json()
    if not data:
        return (jsonify({"error": "No data provided"}), 400)
    result, error = AuthService.login_telegram_user(data)
    if error:
        return (jsonify({"error": error}), 401)
    return (
        jsonify(
            {
                "message": "Login successful",
                "access_token": result["access_token"],
                "refresh_token": result["refresh_token"],
                "user": user_schema.dump(result["user"]),
            }
        ),
        200,
    )


@auth_bp.route("/ai-user", methods=["GET"])
def get_ai_user():
    from app.services.ollama_service import OllamaService
    ai_user = OllamaService.get_ai_user()
    return jsonify(user_schema.dump(ai_user)), 200
