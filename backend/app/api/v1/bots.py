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
        return jsonify({"error": "Bot not found"}), 404
    data = request.get_json() or {}
    message = data.get("message") or {}
    text = (message.get("text") or "").strip()
    if not text:
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
    return jsonify({"ok": True, "update_id": update_id}), 200


@bots_bp.route("/<bot_id>/outbox", methods=["GET"])
@token_required
def get_bot_outbox(current_user, bot_id):
    bot = BotService.get_active_bot_by_id(bot_id)
    if not bot:
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
    return jsonify({"items": items}), 200
