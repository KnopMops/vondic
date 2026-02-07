from app.schemas.user_schema import user_schema
from app.services.auth_service import AuthService
from flask import Blueprint, jsonify, request

auth_bp = Blueprint("auth", __name__, url_prefix="/api/v1/auth")


@auth_bp.route("/register", methods=["POST"])
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
def login():
    data = request.get_json()
    if not data:
        return (jsonify({"error": "No data provided"}), 400)
    result, error = AuthService.login_user(data)
    if error:
        status_code = (
            401
            if error
            in ["Invalid email or password", "User is blocked", "Email not verified"]
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


@auth_bp.route("/telegram-login", methods=["POST"])
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
