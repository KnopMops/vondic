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
    users = UserService.get_all_users()
    return (jsonify(users_schema.dump(users)), 200)


@users_bp.route("/get", methods=["POST"])
def get_user_detail():
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
    key, error = UserService.generate_link_key(current_user.id)
    if error:
        return jsonify({"error": error}), 500
    return jsonify({"link_key": key}), 200


@users_bp.route("/search", methods=["POST"])
@token_required
def search_users(current_user):
    data = request.get_json() or {}
    query = data.get("query")

    if not query:
        return jsonify({"error": "query is required"}), 400

    users = UserService.search_users(query)
    return jsonify(users_schema.dump(users)), 200


@users_bp.route("/internal/process_message", methods=["POST"])
def internal_process_message():
    data = request.get_json() or {}
    message_id = data.get("message_id")
    target_id = data.get("target_id")

    if not message_id or not target_id:
        return jsonify({"error": "Missing data"}), 400

    from app.services.ollama_service import OllamaService
    ai_user = OllamaService.get_ai_user()

    if str(target_id) == str(ai_user.id):
        content = data.get("content")
        sender_id = data.get("sender_id")
        OllamaService.process_message_async(
            message_id, is_dm=True, content=content, sender_id=sender_id)
        return jsonify({"status": "processing"}), 200

    return jsonify({"status": "ignored"}), 200


@users_bp.route("/", methods=["POST"])
def create_user():
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
    data = request.get_json() or {}
    user_id = data.get("user_id")
    admin_user_id = data.get("admin_user_id")

    if not user_id or not admin_user_id:
        return jsonify({"error": "user_id and admin_user_id are required"}), 400

    if str(admin_user_id) != str(current_user.id):
        return jsonify({"error": "Admin User ID mismatch"}), 403

    user, error = UserService.block_user(user_id, current_user)
    if error:
        status_code = 404 if error == "User not found" else 403
        return jsonify({"error": error}), status_code
    return jsonify({"message": "User blocked successfully", "user": user_schema.dump(user)}), 200


@users_bp.route("/unblock", methods=["POST"])
@token_required
def unblock_user(current_user):
    data = request.get_json() or {}
    user_id = data.get("user_id")
    admin_user_id = data.get("admin_user_id")

    if not user_id or not admin_user_id:
        return jsonify({"error": "user_id and admin_user_id are required"}), 400

    if str(admin_user_id) != str(current_user.id):
        return jsonify({"error": "Admin User ID mismatch"}), 403

    user, error = UserService.unblock_user(user_id, current_user)
    if error:
        status_code = 404 if error == "User not found" else 403
        return jsonify({"error": error}), status_code
    return jsonify({"message": "User unblocked successfully", "user": user_schema.dump(user)}), 200


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
    from app.models.gift_catalog import GiftCatalog
    catalog_item = GiftCatalog.query.get(gift_id)
    if catalog_item is not None:
        price = catalog_item.coin_price
        if catalog_item.total_supply is not None:
            if (catalog_item.minted_count or 0) + quantity > catalog_item.total_supply:
                return jsonify({"error": "Gift supply exhausted"}), 400
    else:
        price = GIFT_PRICING.get(gift_id)
    if price is None:
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
        if catalog_item is not None and catalog_item.total_supply is not None:
            catalog_item.minted_count = (catalog_item.minted_count or 0) + quantity
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
    comment = (data.get("comment") or "").strip()
    qty_raw = data.get("quantity", 1)
    target_user_id = data.get("target_user_id")
    try:
        quantity = int(qty_raw) if qty_raw is not None else 1
    except Exception:
        quantity = 1
    if not gift_id or quantity <= 0 or not target_user_id:
        return jsonify({"error": "Invalid parameters"}), 400
    from app.models.gift_catalog import GiftCatalog
    catalog_item = GiftCatalog.query.get(gift_id)
    if catalog_item is not None:
        price = catalog_item.coin_price
        if catalog_item.total_supply is not None:
            if (catalog_item.minted_count or 0) + quantity > catalog_item.total_supply:
                return jsonify({"error": "Gift supply exhausted"}), 400
    else:
        price = GIFT_PRICING.get(gift_id)
    if price is None:
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
            "is_displayed": True,
            "comment": comment or None,
        })
        recipient.gifts = gifts
        if catalog_item is not None and catalog_item.total_supply is not None:
            catalog_item.minted_count = (catalog_item.minted_count or 0) + quantity
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
