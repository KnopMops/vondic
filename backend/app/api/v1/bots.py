import logging
import time

from app.api.public.v1.bots import (
    OUTBOX_LOCK,
    OUTBOX_QUEUES,
    QUEUE_LOCK,
    UPDATE_COUNTERS,
    UPDATE_QUEUES,
)
from app.schemas.bot_schema import bot_schema, bots_schema
from app.services.bot_service import BotService
from app.utils.decorators import token_required
from flask import Blueprint, jsonify, request

bots_bp = Blueprint("bots", __name__, url_prefix="/api/v1/bots")

logger = logging.getLogger(__name__)


@bots_bp.route("/", methods=["GET"])
@token_required
def get_bots(current_user):
    bots = BotService.get_all_bots()
    return jsonify(bots_schema.dump(bots)), 200


@bots_bp.route("/search", methods=["POST"])
@token_required
def search_bots(current_user):
    data = request.get_json() or {}
    query = data.get("query")
    if not query:
        return jsonify({"error": "query is required"}), 400
    bots = BotService.search_bots(query)
    return jsonify(bots_schema.dump(bots)), 200


@bots_bp.route("/", methods=["POST"])
@token_required
def create_bot(current_user):
    data = request.get_json() or {}
    for key in ("id", "created_at", "updated_at"):
        data.pop(key, None)
    bot, error = BotService.create_bot(data)
    if error:
        return jsonify({"error": error}), 400
    token, token_error = BotService.generate_bot_token(bot.id)
    if token_error:
        return jsonify({"error": token_error}), 400
    chat_url = f"/feed/messages?bot_id={bot.id}"
    payload = bot_schema.dump(bot)
    payload.update({"bot_token": token, "chat_url": chat_url})
    return jsonify(payload), 201


@bots_bp.route("/<bot_id>/updates/push", methods=["POST"])
@token_required
def push_bot_update(current_user, bot_id):
    bot = BotService.get_active_bot_by_id(bot_id)
    if not bot:
        logger.info("bot_updates_push_bot_not_found bot_id=%s", bot_id)
        return jsonify({"error": "Bot not found"}), 404
    data = request.get_json() or {}
    message = data.get("message") or {}
    text = (message.get("text") or "").strip()
    if not text:
        logger.info("bot_updates_push_missing_text bot_id=%s", bot_id)
        return jsonify({"error": "message.text is required"}), 400
    from_user = message.get("from_user") or {}
    chat = message.get("chat") or {}
    from_user_id = str(from_user.get("id") or current_user.id)
    chat_id = str(chat.get("id") or current_user.id)
    with QUEUE_LOCK:
        UPDATE_COUNTERS[bot_id] += 1
        update_id = UPDATE_COUNTERS[bot_id]
        update = {
            "update_id": str(update_id),
            "message": {
                "message_id": str(update_id),
                "text": text,
                "from_user": {
                    "id": from_user_id,
                    "username": from_user.get("username") or current_user.username,
                    "avatar_url": from_user.get("avatar_url")
                    or current_user.avatar_url,
                },
                "chat": {
                    "id": chat_id,
                    "type": chat.get("type") or "private",
                    "title": chat.get("title") or current_user.username,
                },
                "date": int(time.time()),
            },
        }
        UPDATE_QUEUES[bot_id].append(update)
    logger.info(
        "bot_updates_pushed bot_id=%s update_id=%s chat_id=%s from_user_id=%s",
        bot_id,
        update_id,
        chat_id,
        from_user_id,
    )
    wait_seconds = request.args.get("wait", type=int)
    if wait_seconds is None:
        wait_seconds = data.get("wait_for_reply")
    try:
        wait_seconds = int(wait_seconds) if wait_seconds is not None else 0
    except Exception:
        wait_seconds = 0
    if wait_seconds < 0:
        wait_seconds = 0
    if wait_seconds > 10:
        wait_seconds = 10
    if wait_seconds <= 0:
        return jsonify({"ok": True, "update_id": update_id}), 200
    start = time.time()
    chat_id = str(chat.get("id") or current_user.id)
    while True:
        items = []
        with OUTBOX_LOCK:
            queue = OUTBOX_QUEUES[bot_id]
            remaining = []
            while queue:
                item = queue.popleft()
                if str(item.get("chat_id")) == chat_id:
                    items.append(item)
                else:
                    remaining.append(item)
            for item in remaining:
                queue.append(item)
        if items:
            logger.info(
                "bot_updates_reply_delivered bot_id=%s update_id=%s count=%s",
                bot_id,
                update_id,
                len(items),
            )
            return jsonify(
                {"ok": True, "update_id": update_id, "outbox": items}), 200
        if time.time() - start >= wait_seconds:
            logger.info(
                "bot_updates_reply_timeout bot_id=%s update_id=%s timeout=%s",
                bot_id,
                update_id,
                wait_seconds,
            )
            return jsonify(
                {"ok": True, "update_id": update_id, "outbox": []}), 200
        time.sleep(0.2)


@bots_bp.route("/<bot_id>/outbox", methods=["GET"])
@token_required
def get_bot_outbox(current_user, bot_id):
    bot = BotService.get_active_bot_by_id(bot_id)
    if not bot:
        logger.info("bot_outbox_bot_not_found bot_id=%s", bot_id)
        return jsonify({"error": "Bot not found"}), 404
    chat_id = request.args.get("chat_id") or str(current_user.id)
    items = []
    with OUTBOX_LOCK:
        queue = OUTBOX_QUEUES[bot_id]
        remaining = []
        while queue:
            item = queue.popleft()
            if str(item.get("chat_id")) == str(chat_id):
                items.append(item)
            else:
                remaining.append(item)
        for item in remaining:
            queue.append(item)
    logger.info(
        "bot_outbox_delivered bot_id=%s chat_id=%s count=%s",
        bot_id,
        chat_id,
        len(items),
    )
    return jsonify({"items": items}), 200


@bots_bp.route("/<bot_id>/verify", methods=["POST"])
@token_required
def verify_bot(current_user, bot_id):
    if current_user.role not in ["Admin", "admin"]:
        return jsonify({"error": "Admin access required"}), 403

    data = request.get_json() or {}
    is_verified = data.get("is_verified", 1)

    bot = BotService.get_bot_by_id(bot_id)
    if not bot:
        return jsonify({"error": "Bot not found"}), 404

    try:
        from app.core.extensions import db
        bot.is_verified = 1 if is_verified else 0
        db.session.commit()
        logger.info(
            "bot_verification_updated bot_id=%s is_verified=%s by_user=%s",
            bot_id,
            bot.is_verified,
            current_user.id,
        )
        return jsonify({"ok": True, "is_verified": bot.is_verified}), 200
    except Exception as e:
        logger.error(
            "bot_verification_error bot_id=%s error=%s",
            bot_id,
            str(e))
        return jsonify({"error": "Failed to update bot verification"}), 500
