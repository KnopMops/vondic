from app.schemas.user_schema import user_schema, users_schema
from app.services.user_service import UserService
from app.utils.decorators import token_required
from flask import Blueprint, jsonify, request

users_bp = Blueprint("users", __name__, url_prefix="/api/v1/users")


@users_bp.route("/", methods=["GET"])
def get_users():
    """
    Получить список всех пользователей
    ---
    tags:
      - Users
    responses:
      200:
        description: Список пользователей
        schema:
          type: array
          items:
            type: object
            properties:
              id:
                type: integer
              username:
                type: string
              email:
                type: string
              balance:
                type: number
    """
    users = UserService.get_all_users()
    return (jsonify(users_schema.dump(users)), 200)


@users_bp.route("/get", methods=["POST"])
def get_user_detail():
    """
    Получить пользователя по ID
    ---
    tags:
      - Users
    parameters:
      - name: body
        in: body
        required: true
        schema:
          type: object
          properties:
            user_id:
              type: string
              required: true
    responses:
      200:
        description: Данные пользователя
        schema:
          type: object
          properties:
            id:
              type: string
            username:
              type: string
            email:
              type: string
            balance:
              type: number
            avatar_url:
              type: string
            status:
              type: string
            role:
              type: string
            created_at:
              type: string
      400:
        description: Не указан user_id
      404:
        description: Пользователь не найден
    """
    data = request.get_json() or {}
    user_id = data.get("user_id")

    if not user_id:
        return jsonify({"error": "user_id is required"}), 400

    user = UserService.get_user_by_id(user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404
    return jsonify(user_schema.dump(user)), 200


@users_bp.route("/search", methods=["POST"])
@token_required
def search_users(current_user):
    """
    Поиск пользователей по имени или email
    ---
    tags:
      - Users
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
            query:
              type: string
              required: true
    responses:
      200:
        description: Список найденных пользователей
      400:
        description: Не указан поисковый запрос
    """
    data = request.get_json() or {}
    query = data.get("query")

    if not query:
        return jsonify({"error": "query is required"}), 400

    users = UserService.search_users(query)
    return jsonify(users_schema.dump(users)), 200


@users_bp.route("/", methods=["POST"])
def create_user():
    """
    Создать нового пользователя
    ---
    tags:
      - Users
    parameters:
      - name: body
        in: body
        required: true
        schema:
          type: object
          properties:
            username:
              type: string
            email:
              type: string
            password:
              type: string
    responses:
      201:
        description: Пользователь создан
      400:
        description: Ошибка создания
    """
    data = request.get_json()
    if not data:
        return (jsonify({"error": "No data provided"}), 400)
    user = UserService.create_user(data)
    if not user:
        return (jsonify({"error": "User could not be created (duplicate?)"}), 400)
    return (jsonify(user_schema.dump(user)), 201)


@users_bp.route("/", methods=["PUT"])
@token_required
def update_user(current_user):
    """
    Обновить данные пользователя
    ---
    tags:
      - Users
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
            user_id:
              type: string
              required: true
            username:
              type: string
            email:
              type: string
            avatar_url:
              type: string
    responses:
      200:
        description: Пользователь обновлен
      400:
        description: Ошибка валидации
      403:
        description: Нет прав
      404:
        description: Пользователь не найден
    """
    data = request.get_json()
    if not data:
        return jsonify({"error": "No data provided"}), 400

    user_id = data.get("user_id")
    if not user_id:
        return jsonify({"error": "user_id is required"}), 400

    user, error = UserService.update_user(user_id, data, current_user)
    if error:
        status_code = 404 if error == "User not found" else 400
        if error == "Unauthorized":
            status_code = 403
        return jsonify({"error": error}), status_code

    return jsonify(user_schema.dump(user)), 200


@users_bp.route("/block", methods=["POST"])
@token_required
def block_user(current_user):
    """
    Заблокировать пользователя (Только админ)
    ---
    tags:
      - Users
    security:
      - Bearer: []
    parameters:
      - name: body
        in: body
        required: true
        schema:
          type: object
          properties:
            user_id:
              type: string
              description: ID пользователя которого блокируем
              required: true
            admin_user_id:
              type: string
              description: ID админа (должен совпадать с текущим)
              required: true
    responses:
      200:
        description: Пользователь заблокирован
      400:
        description: Неверные параметры
      403:
        description: Нет прав
      404:
        description: Пользователь не найден
    """
    data = request.get_json() or {}
    user_id = data.get("user_id")
    admin_user_id = data.get("admin_user_id")

    if not user_id or not admin_user_id:
        return jsonify({"error": "user_id and admin_user_id are required"}), 400

    if str(admin_user_id) != str(current_user.id):
        return jsonify({"error": "Admin User ID mismatch"}), 403

    is_admin = current_user.role == "Admin"
    user, error = UserService.block_user(user_id, is_admin)
    if error:
        status_code = 404 if error == "User not found" else 403
        return jsonify({"error": error}), status_code
    return jsonify({"message": "User blocked successfully", "user": user_schema.dump(user)}), 200


@users_bp.route("/unblock", methods=["POST"])
@token_required
def unblock_user(current_user):
    """
    Разблокировать пользователя (Только админ)
    ---
    tags:
      - Users
    security:
      - Bearer: []
    parameters:
      - name: body
        in: body
        required: true
        schema:
          type: object
          properties:
            user_id:
              type: string
              description: ID пользователя которого разблокируем
              required: true
            admin_user_id:
              type: string
              description: ID админа (должен совпадать с текущим)
              required: true
    responses:
      200:
        description: Пользователь разблокирован
      400:
        description: Неверные параметры
      403:
        description: Нет прав
      404:
        description: Пользователь не найден
    """
    data = request.get_json() or {}
    user_id = data.get("user_id")
    admin_user_id = data.get("admin_user_id")

    if not user_id or not admin_user_id:
        return jsonify({"error": "user_id and admin_user_id are required"}), 400

    if str(admin_user_id) != str(current_user.id):
        return jsonify({"error": "Admin User ID mismatch"}), 403

    is_admin = current_user.role == "Admin"
    user, error = UserService.unblock_user(user_id, is_admin)
    if error:
        status_code = 404 if error == "User not found" else 403
        return jsonify({"error": error}), status_code
    return jsonify({"message": "User unblocked successfully", "user": user_schema.dump(user)}), 200
