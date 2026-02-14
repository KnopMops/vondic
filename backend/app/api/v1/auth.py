from app.schemas.user_schema import user_schema
from app.services.auth_service import AuthService
from app.services.user_service import UserService
from app.utils.decorators import token_required
from flask import Blueprint, current_app, jsonify, request

auth_bp = Blueprint("auth", __name__, url_prefix="/api/v1/auth")


@auth_bp.route("/register", methods=["POST"])
def register():
    """
    Регистрация нового пользователя
    ---
    tags:
      - Auth
    parameters:
      - name: body
        in: body
        required: true
        schema:
          type: object
          properties:
            username:
              type: string
              example: "johndoe"
            email:
              type: string
              example: "john@example.com"
            password:
              type: string
              example: "secret123"
    responses:
      201:
        description: Пользователь успешно создан
        schema:
          type: object
          properties:
            message:
              type: string
            user:
              type: object
            access_token:
              type: string
            refresh_token:
              type: string
      400:
        description: Ошибка валидации или пользователь уже существует
    """
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
def login():
    """
    Аутентификация пользователя
    ---
    tags:
      - Auth
    parameters:
      - name: body
        in: body
        required: true
        schema:
          type: object
          properties:
            email:
              type: string
              example: "john@example.com"
            password:
              type: string
              example: "secret123"
    responses:
      200:
        description: Успешный вход
        schema:
          type: object
          properties:
            message:
              type: string
            access_token:
              type: string
            refresh_token:
              type: string
            user:
              type: object
      401:
        description: Неверный email или пароль
    """
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
    """
    Link Telegram account using a link key
    ---
    tags:
      - Auth
    parameters:
      - name: body
        in: body
        required: true
        schema:
          type: object
          properties:
            link_key:
              type: string
            telegram_id:
              type: string
    responses:
      200:
        description: Account linked successfully
      400:
        description: Invalid key or error
    """
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
    """
    Получить текущего пользователя
    ---
    tags:
      - Auth
    parameters:
      - name: body
        in: body
        required: true
        schema:
          type: object
          properties:
            access_token:
              type: string
              required: true
    responses:
      200:
        description: Текущий пользователь
        schema:
          type: object
          properties:
            message:
              type: string
            is_authenticated:
              type: boolean
            user:
              type: object
      400:
        description: Токен не передан
      401:
        description: Неверный токен
    """
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
        # In non-production or misconfigured mail, return code inline for development
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
def telegram_login():
    """
    Аутентификация через Telegram
    ---
    tags:
      - Auth
    parameters:
      - name: body
        in: body
        required: true
        schema:
          type: object
          properties:
            id:
              type: integer
            first_name:
              type: string
            username:
              type: string
            photo_url:
              type: string
            auth_date:
              type: integer
            hash:
              type: string
    responses:
      200:
        description: Успешный вход
        schema:
          type: object
          properties:
            message:
              type: string
            access_token:
              type: string
            refresh_token:
              type: string
            user:
              type: object
      400:
        description: Ошибка авторизации или неверная подпись
    """
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
    """
    Получить пользователя Vondic AI
    """
    from app.services.ollama_service import OllamaService
    ai_user = OllamaService.get_ai_user()
    return jsonify(user_schema.dump(ai_user)), 200
