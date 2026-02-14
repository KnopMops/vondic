from datetime import datetime

from app.core.extensions import db
from app.models.user import User
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


@users_bp.route("/by-telegram/<telegram_id>", methods=["GET"])
def get_user_by_telegram(telegram_id):
    """
    Получить пользователя по Telegram ID
    ---
    tags:
      - Users
    parameters:
      - name: telegram_id
        in: path
        required: true
        type: string
    responses:
      200:
        description: Данные пользователя
      404:
        description: Пользователь не найден
    """
    user = UserService.get_user_by_telegram_id(telegram_id)
    if not user:
        return jsonify({"error": "User not found"}), 404
    return jsonify(user_schema.dump(user)), 200


@users_bp.route("/by-email/<email>", methods=["GET"])
def get_user_by_email(email):
    user = UserService.get_user_by_email(email)
    if not user:
        return jsonify({"error": "User not found"}), 404
    return jsonify(user_schema.dump(user)), 200


@users_bp.route("/link-key", methods=["POST"])
@token_required
def generate_link_key(current_user):
    """
    Generate a temporary link key for Telegram integration
    ---
    tags:
      - Users
    security:
      - Bearer: []
    responses:
      200:
        description: Link key generated
        schema:
            type: object
            properties:
                link_key:
                    type: string
    """
    key, error = UserService.generate_link_key(current_user.id)
    if error:
        return jsonify({"error": error}), 500
    return jsonify({"link_key": key}), 200


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


@users_bp.route("/internal/process_message", methods=["POST"])
def internal_process_message():
    """
    Internal endpoint for signaling server to notify backend about new DM
    """
    data = request.get_json() or {}
    message_id = data.get("message_id")
    target_id = data.get("target_id")

    if not message_id or not target_id:
        return jsonify({"error": "Missing data"}), 400

    # Check if target is AI
    from app.services.ollama_service import OllamaService
    ai_user = OllamaService.get_ai_user()

    if str(target_id) == str(ai_user.id):
        # Trigger AI processing
        content = data.get("content")
        sender_id = data.get("sender_id")
        OllamaService.process_message_async(
            message_id, is_dm=True, content=content, sender_id=sender_id)
        return jsonify({"status": "processing"}), 200

    return jsonify({"status": "ignored"}), 200


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


# Gift pricing in coins (server-side authoritative)
GIFT_PRICING = {
    "newyear_fireworks": 99,
    "valentine_heart": 39,
    "womens_day_bouquet": 89,
    "birthday_cake": 149,
    "halloween_pumpkin": 59,
    "easter_egg": 49,
    "christmas_gift": 99,
    "knowledge_day_coffee": 39,
    "anniversary_crown": 199,
    "party_flame": 29,
    "partner_badge": 1999,
    "gold_star": 1999,
}


@users_bp.route("/purchase-gift", methods=["POST"])
@token_required
def purchase_gift(current_user):
    data = request.get_json() or {}
    gift_id = data.get("gift_id")
    qty_raw = data.get("quantity", 1)
    try:
        quantity = int(qty_raw) if qty_raw is not None else 1
    except Exception:
        quantity = 1
    if not gift_id or quantity <= 0:
        return jsonify({"error": "Invalid parameters"}), 400
    # Prefer price from catalog if available
    from app.models.gift_catalog import GiftCatalog
    catalog_item = GiftCatalog.query.get(gift_id)
    price = (catalog_item.coin_price if catalog_item else None) or GIFT_PRICING.get(
        gift_id)
    if not price:
        return jsonify({"error": "Unknown gift"}), 400
    total = price * quantity
    if (current_user.balance or 0) < total:
        return jsonify({"error": "Insufficient balance"}), 400
    try:
        current_user.balance = (current_user.balance or 0) - total
        gifts = list(current_user.gifts or [])
        gifts.append({
            "gift_id": gift_id,
            "quantity": quantity,
            "from_user_id": current_user.id,
            "created_at": datetime.utcnow().isoformat(),
            "is_displayed": False
        })
        current_user.gifts = gifts
        db.session.commit()
        return jsonify({"success": True, "balance": current_user.balance, "gifts": current_user.gifts}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


@users_bp.route("/send-gift", methods=["POST"])
@token_required
def send_gift(current_user):
    data = request.get_json() or {}
    gift_id = data.get("gift_id")
    qty_raw = data.get("quantity", 1)
    target_user_id = data.get("target_user_id")
    try:
        quantity = int(qty_raw) if qty_raw is not None else 1
    except Exception:
        quantity = 1
    if not gift_id or quantity <= 0 or not target_user_id:
        return jsonify({"error": "Invalid parameters"}), 400
    price = GIFT_PRICING.get(gift_id)
    if not price:
        return jsonify({"error": "Unknown gift"}), 400
    total = price * quantity
    if (current_user.balance or 0) < total:
        return jsonify({"error": "Insufficient balance"}), 400
    recipient = User.query.get(target_user_id)
    if not recipient:
        return jsonify({"error": "Recipient not found"}), 404
    try:
        current_user.balance = (current_user.balance or 0) - total
        gifts = list(recipient.gifts or [])
        gifts.append({
            "gift_id": gift_id,
            "quantity": quantity,
            "from_user_id": current_user.id,
            "created_at": datetime.utcnow().isoformat(),
            "is_displayed": True
        })
        recipient.gifts = gifts
        db.session.commit()
        return jsonify({"success": True, "balance": current_user.balance, "recipient_gifts": recipient.gifts}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


@users_bp.route("/set-gift-display", methods=["POST"])
@token_required
def set_gift_display(current_user):
    data = request.get_json() or {}
    gift_index = data.get("gift_index")
    is_displayed = data.get("is_displayed")
    if gift_index is None or is_displayed is None:
        return jsonify({"error": "gift_index and is_displayed are required"}), 400
    gifts = list(current_user.gifts or [])
    if gift_index < 0 or gift_index >= len(gifts):
        return jsonify({"error": "gift_index out of range"}), 400
    gifts[gift_index]["is_displayed"] = bool(is_displayed)
    try:
        current_user.gifts = gifts
        db.session.commit()
        return jsonify({"success": True, "gifts": current_user.gifts}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500
