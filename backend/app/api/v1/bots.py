import logging
import time

import app.api.public.v1.bots as _pub_bots

from app.api.public.v1.bots import (
    _redis_next_id,
    _redis_push,
    _redis_pop_matching,
    _redis_counter_incr,
    UPDATE_QUEUES,
    QUEUE_LOCK,
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
    data["owner_id"] = str(current_user.id)
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
    """Push an update to a bot. Accepts ALL message content types:
    text, photo, video, document, audio, voice, video_note, sticker,
    location, venue, contact, poll, dice, and callback_query."""
    bot = BotService.get_active_bot_by_id(bot_id)
    if not bot:
        logger.info("bot_updates_push_bot_not_found bot_id=%s", bot_id)
        return jsonify({"error": "Bot not found"}), 404
    data = request.get_json() or {}
    message = data.get("message") or {}
    text = (message.get("text") or "").strip()

    # Detect content type — accept any non-empty content
    content_type = "text"
    if message.get("photo"):
        content_type = "photo"
    elif message.get("video"):
        content_type = "video"
    elif message.get("document"):
        content_type = "document"
    elif message.get("audio"):
        content_type = "audio"
    elif message.get("voice"):
        content_type = "voice"
    elif message.get("video_note"):
        content_type = "video_note"
    elif message.get("sticker"):
        content_type = "sticker"
    elif message.get("location"):
        content_type = "location"
    elif message.get("venue"):
        content_type = "venue"
    elif message.get("contact"):
        content_type = "contact"
    elif message.get("poll"):
        content_type = "poll"
    elif message.get("dice"):
        content_type = "dice"

    if not text and content_type == "text":
        logger.info("bot_updates_push_missing_content bot_id=%s", bot_id)
        return jsonify({"error": "message content is required (text or other content type)"}), 400

    from_user = message.get("from_user") or {}
    chat = message.get("chat") or {}
    from_user_id = str(from_user.get("id") or current_user.id)
    chat_id = str(chat.get("id") or current_user.id)
    update_id = _redis_next_id()

    # Build message with all content types
    msg_payload = {
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
    }
    # Forward all content types
    for field in ("photo", "video", "document", "audio", "voice", "video_note",
                  "sticker", "location", "venue", "contact", "poll", "dice", "caption"):
        val = message.get(field)
        if val is not None:
            msg_payload[field] = val

    update = {
        "update_id": str(update_id),
        "message": msg_payload,
    }
    # Forward callback_query if present
    if data.get("callback_query"):
        update["callback_query"] = data["callback_query"]

    _redis_push(f"updates:{bot_id}", update)
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
        items = _redis_pop_matching(
            f"outbox:{bot_id}",
            lambda item: str(item.get("chat_id")) == str(chat_id),
        )
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
    items = _redis_pop_matching(
        f"outbox:{bot_id}",
        lambda item: str(item.get("chat_id")) == str(chat_id),
    )
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


# ── Bot permissions (internal API — user JWT auth) ───────────────────

@bots_bp.route("/<bot_id>/permissions", methods=["GET"])
@token_required
def get_my_bot_permissions(current_user, bot_id):
    """Get current user's permissions for a bot."""
    try:
        from app.services.bot_permission_service import BotPermissionService
        scopes = BotPermissionService.get_user_scopes(bot_id, str(current_user.id))
        return jsonify({
            "granted": bool(scopes),
            "scopes": scopes.split(",") if scopes else [],
        }), 200
    except Exception as e:
        logger.exception("bot_permissions_get_error user=%s bot=%s error=%s", current_user.id, bot_id, e)
        return jsonify({"error": "Internal server error"}), 500


@bots_bp.route("/<bot_id>/permissions/grant", methods=["POST"])
@token_required
def grant_bot_permissions(current_user, bot_id):
    """Grant permissions to a bot for the current user."""
    try:
        data = request.get_json() or {}
        scopes = data.get("scopes", "basic_profile,send_messages")
        from app.services.bot_permission_service import BotPermissionService
        perm = BotPermissionService.grant_scopes(bot_id, str(current_user.id), scopes)
        return jsonify({"ok": True, "scopes": perm.scopes}), 200
    except Exception as e:
        logger.exception("bot_permissions_grant_error user=%s bot=%s error=%s", current_user.id, bot_id, e)
        return jsonify({"error": "Internal server error"}), 500


@bots_bp.route("/<bot_id>/permissions", methods=["DELETE"])
@token_required
def revoke_bot_permissions(current_user, bot_id):
    """Revoke all permissions for a bot."""
    try:
        from app.services.bot_permission_service import BotPermissionService
        BotPermissionService.revoke_scopes(bot_id, str(current_user.id))
        return jsonify({"ok": True}), 200
    except Exception as e:
        logger.exception("bot_permissions_revoke_error user=%s bot=%s error=%s", current_user.id, bot_id, e)
        return jsonify({"error": "Internal server error"}), 500
