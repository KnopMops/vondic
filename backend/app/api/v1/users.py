from app.schemas.user_schema import user_schema, users_schema
from app.services.user_service import UserService
from flask import Blueprint, jsonify, request

users_bp = Blueprint("users", __name__, url_prefix="/api/v1/users")


@users_bp.route("/", methods=["GET"])
def get_users():
    users = UserService.get_all_users()
    return (jsonify(users_schema.dump(users)), 200)


@users_bp.route("/<user_id>", methods=["GET"])
def get_user(user_id):
    user = UserService.get_user_by_id(user_id)
    if not user:
        return (jsonify({"error": "User not found"}), 404)
    return (jsonify(user_schema.dump(user)), 200)


@users_bp.route("/", methods=["POST"])
def create_user():
    data = request.get_json()
    if not data:
        return (jsonify({"error": "No data provided"}), 400)
    user = UserService.create_user(data)
    if not user:
        return (jsonify({"error": "User could not be created (duplicate?)"}), 400)
    return (jsonify(user_schema.dump(user)), 201)
