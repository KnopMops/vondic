from datetime import datetime, timedelta

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
        return jsonify({"error": "Требуется user_id"}), 400

    user = UserService.get_user_by_id(user_id)
    if not user:
        return jsonify({"error": "Пользователь не найден"}), 404
    return jsonify(user_schema.dump(user)), 200


@users_bp.route("/by-email/<email>", methods=["GET"])
def get_user_by_email(email):
    user = UserService.get_user_by_email(email)
    if not user:
        return jsonify({"error": "Пользователь не найден"}), 404
    return jsonify(user_schema.dump(user)), 200


@users_bp.route("/search", methods=["POST"])
@token_required
def search_users(current_user):
    data = request.get_json() or {}
    query = data.get("query")

    if not query:
        return jsonify({"error": "Требуется query"}), 400

    users = UserService.search_users(query)
    return jsonify(users_schema.dump(users)), 200


@users_bp.route("/internal/process_message", methods=["POST"])
def internal_process_message():
    data = request.get_json() or {}
    message_id = data.get("message_id")
    target_id = data.get("target_id")

    if not message_id or not target_id:
        return jsonify({"error": "Отсутствуют данные"}), 400

    from app.services.ollama_service import OllamaService

    ai_user = OllamaService.get_ai_user()

    if str(target_id) == str(ai_user.id):
        content = data.get("content")
        sender_id = data.get("sender_id")
        OllamaService.process_message_async(
            message_id, is_dm=True, content=content, sender_id=sender_id
        )
        return jsonify({"status": "processing"}), 200

    return jsonify({"status": "ignored"}), 200


@users_bp.route("/", methods=["POST"])
def create_user():
    data = request.get_json()
    if not data:
        return (jsonify({"error": "Нет данных"}), 400)
    user = UserService.create_user(data)
    if not user:
        return (
            jsonify({"error": "Не удалось создать пользователя (дубликат?)"}), 400)
    return (jsonify(user_schema.dump(user)), 201)


@users_bp.route("/", methods=["PUT"])
@token_required
def update_user(current_user):
    data = request.get_json()
    if not data:
        return jsonify({"error": "Нет данных"}), 400

    user_id = data.get("user_id")
    if not user_id:
        return jsonify({"error": "Требуется user_id"}), 400

    user, error = UserService.update_user(user_id, data, current_user)
    if error:
        status_code = 404 if error == "Пользователь не найден" else 400
        if error == "Неавторизовано":
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
        return jsonify(
            {"error": "Требуется user_id и admin_user_id"}), 400

    if str(admin_user_id) != str(current_user.id):
        return jsonify({"error": "Несоответствие ID администратора"}), 403

    user, error = UserService.block_user(user_id, current_user)
    if error:
        status_code = 404 if error == "Пользователь не найден" else 403
        return jsonify({"error": error}), status_code
    return jsonify(
        {"message": "Пользователь заблокирован",
            "user": user_schema.dump(user)}
    ), 200


@users_bp.route("/unblock", methods=["POST"])
@token_required
def unblock_user(current_user):
    data = request.get_json() or {}
    user_id = data.get("user_id")
    admin_user_id = data.get("admin_user_id")

    if not user_id or not admin_user_id:
        return jsonify(
            {"error": "Требуется user_id и admin_user_id"}), 400

    if str(admin_user_id) != str(current_user.id):
        return jsonify({"error": "Несоответствие ID администратора"}), 403

    user, error = UserService.unblock_user(user_id, current_user)
    if error:
        status_code = 404 if error == "Пользователь не найден" else 403
        return jsonify({"error": error}), status_code
    return jsonify(
        {"message": "Пользователь разблокирован",
            "user": user_schema.dump(user)}
    ), 200


@users_bp.route("/block-user", methods=["POST"])
@token_required
def block_user_by_user(current_user):
    data = request.get_json() or {}
    blocked_id = data.get("user_id")
    if not blocked_id:
        return jsonify({"error": "Требуется user_id"}), 400
    result, error = UserService.block_user_by_user(str(current_user.id), str(blocked_id))
    if error:
        return jsonify({"error": error}), 400
    return jsonify({"message": "Пользователь заблокирован"}), 200


@users_bp.route("/unblock-user", methods=["POST"])
@token_required
def unblock_user_by_user(current_user):
    data = request.get_json() or {}
    blocked_id = data.get("user_id")
    if not blocked_id:
        return jsonify({"error": "Требуется user_id"}), 400
    result, error = UserService.unblock_user_by_user(str(current_user.id), str(blocked_id))
    if error:
        return jsonify({"error": error}), 400
    return jsonify({"message": "Пользователь разблокирован"}), 200


@users_bp.route("/block-status", methods=["POST"])
@token_required
def block_status(current_user):
    data = request.get_json() or {}
    target_id = data.get("user_id")
    if not target_id:
        return jsonify({"error": "Требуется user_id"}), 400
    status = UserService.get_block_status(str(current_user.id), str(target_id))
    return jsonify(status), 200


@users_bp.route("/delete", methods=["DELETE"])
@token_required
def delete_user_account(current_user):
    success, error = UserService.delete_user_account(current_user.id)
    if error:
        status_code = 404 if error == "Пользователь не найден" else 400
        return jsonify({"error": error}), status_code
    return jsonify({"message": "Пользователь успешно удалён"}), 200


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
STORAGE_TB_PRICE = 6500
STORAGE_TB_BYTES = 1024 * 1024 * 1024 * 1024

PREMIUM_COIN_PRICE = 50
PREMIUM_DURATION_DAYS = 30


@users_bp.route("/buy-premium-coins", methods=["POST"])
@token_required
def buy_premium_coins(current_user):
    """Оплата Premium внутриигровыми коинами (магазин)."""
    price = PREMIUM_COIN_PRICE
    if (current_user.balance or 0) < price:
        return jsonify({"error": "Недостаточно коинов"}), 400
    try:
        now = datetime.utcnow()
        base = now
        if (
            getattr(current_user, "premium", 0)
            and current_user.premium_expired_at
            and current_user.premium_expired_at > now
        ):
            base = current_user.premium_expired_at
        new_expiry = base + timedelta(days=PREMIUM_DURATION_DAYS)
        current_user.balance = (current_user.balance or 0) - price
        current_user.premium = 1
        if not current_user.premium_started_at:
            current_user.premium_started_at = now
        current_user.premium_expired_at = new_expiry
        db.session.commit()
        return jsonify(
            {
                "success": True,
                "balance": current_user.balance,
                "premium": True,
                "premium_expired_at": new_expiry.isoformat(),
            }
        ), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


@users_bp.route("/gift-premium-coins", methods=["POST"])
@token_required
def gift_premium_coins(current_user):
    """Подарить Vondic Premium (30 дней) за коины любому пользователю по ID."""
    data = request.get_json() or {}
    target_user_id = data.get("target_user_id")
    if not target_user_id:
        return jsonify({"error": "Требуется target_user_id"}), 400
    if str(target_user_id) == str(current_user.id):
        return jsonify({"error": "Нельзя подарить Premium самому себе"}), 400
    price = PREMIUM_COIN_PRICE
    if (current_user.balance or 0) < price:
        return jsonify({"error": "Недостаточно коинов"}), 400
    recipient = User.query.get(target_user_id)
    if not recipient:
        return jsonify({"error": "Получатель не найден"}), 404
    try:
        now = datetime.utcnow()
        base = now
        if (
            getattr(recipient, "premium", 0)
            and recipient.premium_expired_at
            and recipient.premium_expired_at > now
        ):
            base = recipient.premium_expired_at
        new_expiry = base + timedelta(days=PREMIUM_DURATION_DAYS)
        current_user.balance = (current_user.balance or 0) - price
        recipient.premium = 1
        if not recipient.premium_started_at:
            recipient.premium_started_at = now
        recipient.premium_expired_at = new_expiry
        db.session.commit()
        try:
            from app.api.v1.support import notify_user

            notify_user(
                str(recipient.id),
                f"Вам подарили Vondic Premium на 30 дней от @{current_user.username}.",
                title="Подарок — Premium",
                notification_type="system",
                send_email_copy=True,
            )
        except Exception:
            pass
        return jsonify(
            {
                "success": True,
                "balance": current_user.balance,
                "recipient_premium_expired_at": new_expiry.isoformat(),
            }
        ), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


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
        return jsonify({"error": "Неверные параметры"}), 400
    from app.models.gift_catalog import GiftCatalog

    catalog_item = GiftCatalog.query.get(gift_id)
    if catalog_item is not None:
        price = catalog_item.coin_price
        if catalog_item.total_supply is not None:
            if (catalog_item.minted_count or 0) + \
                    quantity > catalog_item.total_supply:
                return jsonify({"error": "Лимит подарков исчерпан"}), 400
    else:
        price = GIFT_PRICING.get(gift_id)
    if price is None:
        return jsonify({"error": "Неизвестный подарок"}), 400
    # Limit to 1 per user
    existing_gifts = list(current_user.gifts or [])
    already_owned = any(g.get("gift_id") == gift_id for g in existing_gifts)
    if already_owned:
        return jsonify({"error": "У вас уже есть этот подарок"}), 400
    total = price * quantity
    if (current_user.balance or 0) < total:
        return jsonify({"error": "Недостаточно средств"}), 400
    try:
        current_user.balance = (current_user.balance or 0) - total
        gifts = list(existing_gifts)
        gifts.append(
            {
                "gift_id": gift_id,
                "quantity": 1,
                "from_user_id": current_user.id,
                "created_at": datetime.utcnow().isoformat(),
                "is_displayed": False,
            }
        )
        current_user.gifts = gifts
        if catalog_item is not None and catalog_item.total_supply is not None:
            catalog_item.minted_count = (
                catalog_item.minted_count or 0) + quantity
        db.session.commit()
        return jsonify(
            {
                "success": True,
                "balance": current_user.balance,
                "gifts": current_user.gifts,
            }
        ), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


@users_bp.route("/purchase-storage", methods=["POST"])
@token_required
def purchase_storage(current_user):
    data = request.get_json() or {}
    qty_raw = data.get("quantity", 1)
    try:
        quantity = int(qty_raw) if qty_raw is not None else 1
    except Exception:
        quantity = 1
    if quantity < 1:
        return jsonify({"error": "Неверные параметры"}), 400
    total_price = STORAGE_TB_PRICE * quantity
    if (current_user.balance or 0) < total_price:
        return jsonify({"error": "Недостаточно средств"}), 400
    try:
        current_user.balance = (current_user.balance or 0) - total_price
        current_user.storage_bonus = (current_user.storage_bonus or 0) + (
            STORAGE_TB_BYTES * quantity
        )
        db.session.commit()
        return jsonify(
            {
                "success": True,
                "balance": current_user.balance,
                "storage_bonus": current_user.storage_bonus,
                "disk_limit": current_user.disk_limit,
            }
        ), 200
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
        return jsonify({"error": "Неверные параметры"}), 400
    if str(target_user_id) == str(current_user.id):
        return jsonify({"error": "Нельзя отправить подарок самому себе"}), 400
    from app.models.gift_catalog import GiftCatalog

    catalog_item = GiftCatalog.query.get(gift_id)
    if catalog_item is not None:
        price = catalog_item.coin_price
        if catalog_item.total_supply is not None:
            if (catalog_item.minted_count or 0) + \
                    quantity > catalog_item.total_supply:
                return jsonify({"error": "Лимит подарков исчерпан"}), 400
    else:
        price = GIFT_PRICING.get(gift_id)
    if price is None:
        return jsonify({"error": "Неизвестный подарок"}), 400
    total = price * quantity
    if (current_user.balance or 0) < total:
        return jsonify({"error": "Недостаточно средств"}), 400
    recipient = User.query.get(target_user_id)
    if not recipient:
        return jsonify({"error": "Получатель не найден"}), 404
    try:
        current_user.balance = (current_user.balance or 0) - total
        gifts = list(recipient.gifts or [])
        gifts.append(
            {
                "gift_id": gift_id,
                "quantity": quantity,
                "from_user_id": current_user.id,
                "created_at": datetime.utcnow().isoformat(),
                "is_displayed": True,
                "comment": comment or None,
            }
        )
        recipient.gifts = gifts
        if catalog_item is not None and catalog_item.total_supply is not None:
            catalog_item.minted_count = (
                catalog_item.minted_count or 0) + quantity
        db.session.commit()
        return jsonify(
            {
                "success": True,
                "balance": current_user.balance,
                "recipient_gifts": recipient.gifts,
            }
        ), 200
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
        return jsonify(
            {"error": "Требуется gift_index и is_displayed"}), 400
    gifts = list(current_user.gifts or [])
    if gift_index < 0 or gift_index >= len(gifts):
        return jsonify({"error": "gift_index вне диапазона"}), 400
    gifts[gift_index]["is_displayed"] = bool(is_displayed)
    try:
        current_user.gifts = gifts
        db.session.commit()
        return jsonify({"success": True, "gifts": current_user.gifts}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


@users_bp.route("/status", methods=["POST"])
@token_required
def set_user_status(current_user):

    data = request.get_json() or {}
    status = data.get("status")

    if not status or status not in ["online", "offline"]:
        return jsonify(
            {"error": "Неверный статус. Должен быть 'online' или 'offline'"}), 400

    try:
        current_user.status = status
        current_user.last_seen = datetime.utcnow()

        if status == "offline":
            current_user.socket_id = None
        db.session.commit()
        return jsonify({"success": True, "status": status}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


@users_bp.route("/pinned-chats", methods=["POST"])
@token_required
def set_pinned_chats(current_user):
    data = request.get_json() or {}
    pinned_chats = data.get("pinned_chats", [])

    if not current_user.premium or (
            current_user.premium_expired_at and current_user.premium_expired_at < datetime.utcnow()):
        return jsonify({"error": "Требуется подписка Premium"}), 403

    if not isinstance(pinned_chats, list):
        return jsonify({"error": "pinned_chats должен быть списком"}), 400

    if len(pinned_chats) > 5:
        return jsonify({"error": "Максимум 5 закреплённых чатов"}), 400

    try:
        current_user.pinned_chats = pinned_chats
        db.session.commit()
        return jsonify({"success": True, "pinned_chats": pinned_chats}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500
