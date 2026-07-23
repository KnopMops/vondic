import json
import logging
import os
import time
from collections import defaultdict, deque
from threading import Lock

from app.schemas.bot_schema import bot_schema, bots_schema
from app.services.bot_service import BotService
from app.utils.decorators import api_key_required
from flask import Blueprint, jsonify, request

public_bots_bp = Blueprint("public_bots", __name__,
                           url_prefix="/api/public/v1/bots")

logger = logging.getLogger(__name__)

# Redis-backed shared state for multi-worker gunicorn
import redis as _redis_mod
_redis = None

def _get_redis():
    global _redis
    if _redis is None:
        _redis = _redis_mod.Redis(
            host=os.environ.get("REDIS_HOST", "redis"),
            port=int(os.environ.get("REDIS_PORT", 6379)),
            db=0, decode_responses=True,
            socket_connect_timeout=3,
        )
        # Auto-clean wrong-type keys from legacy in-memory state
        try:
            for key in _redis.scan_iter("botik:*"):
                if key == "botik:global_counter":
                    continue
                if _redis.type(key) != "list":
                    _redis.delete(key)
        except Exception:
            pass
    return _redis

def _redis_push(queue_name, item):
    _get_redis().rpush(f"botik:{queue_name}", json.dumps(item, default=str))

def _redis_pop_all(queue_name):
    """Atomically pop all items from a Redis list."""
    r = _get_redis()
    key = f"botik:{queue_name}"
    pipe = r.pipeline()
    pipe.lrange(key, 0, -1)
    pipe.delete(key)
    results = pipe.execute()
    return [json.loads(x) for x in results[0]]

def _redis_pop_matching(queue_name, predicate):
    """Pop all items matching predicate, return (matches, rest)."""
    r = _get_redis()
    key = f"botik:{queue_name}"
    items = [json.loads(x) for x in r.lrange(key, 0, -1)]
    r.delete(key)
    matches = []
    rest = []
    for item in items:
        if predicate(item):
            matches.append(item)
        else:
            rest.append(item)
    if rest:
        pipe = r.pipeline()
        for item in rest:
            pipe.rpush(key, json.dumps(item, default=str))
        pipe.execute()
    return matches

def _redis_len(queue_name):
    return _get_redis().llen(f"botik:{queue_name}")

def _redis_next_id():
    """Atomic counter using Redis INCR — never resets."""
    return _get_redis().incr("botik:global_counter")

def _redis_counter_incr(prefix, bot_id):
    return _get_redis().incr(f"botik:counter:{prefix}:{bot_id}")

# Legacy-compatible names for imports in v1/bots.py
QUEUE_LOCK = Lock()
OUTBOX_LOCK = Lock()
UPDATE_QUEUES = defaultdict(deque)  # unused, kept for import compat
UPDATE_COUNTERS = defaultdict(int)  # unused
OUTBOX_QUEUES = defaultdict(deque)  # unused
OUTBOX_COUNTERS = defaultdict(int)  # unused

# Bot token cache: {bot_id: valid_until}
_bot_token_cache = {}
BOT_TOKEN_CACHE_TTL = 300


def _get_bot_token():
    auth = request.headers.get("Authorization") or ""
    if auth.startswith("Bot "):
        return auth.replace("Bot ", "", 1).strip()
    header_token = request.headers.get("X-Bot-Token")
    if header_token:
        return header_token.strip()
    return None


def _verify_bot_token(bot_id):
    token = _get_bot_token()
    if not token:
        return None, (jsonify({"error": "Bot token is required"}), 401)

    cache_key = f"{bot_id}:{token}"
    cached = _bot_token_cache.get(cache_key)
    if cached and time.time() < cached:
        return token, None

    try:
        result = BotService.verify_bot_token(bot_id, token)
    except Exception:
        logger.exception("bot_token_verify_error bot_id=%s", bot_id)
        result = None

    if result:
        _bot_token_cache[cache_key] = time.time() + BOT_TOKEN_CACHE_TTL
        return token, None

    # If DB is down but we have an active bot, allow (soft fail)
    if _redis_len(f"updates:{bot_id}") > 0 or _redis_len(f"outbox:{bot_id}") > 0:
        logger.warning("bot_token_soft_pass bot_id=%s db_unavailable", bot_id)
        _bot_token_cache[cache_key] = time.time() + 30
        return token, None

    return None, (jsonify({"error": "Invalid bot token"}), 401)


@public_bots_bp.route("/", methods=["GET"])
def list_public_bots():
    bots = BotService.get_active_bots()
    return jsonify(bots_schema.dump(bots)), 200


@public_bots_bp.route("/<bot_id>", methods=["GET"])
def get_public_bot(bot_id):
    bot = BotService.get_active_bot_by_id(bot_id)
    if not bot:
        return jsonify({"error": "Bot not found"}), 404
    return jsonify(bot_schema.dump(bot)), 200


@public_bots_bp.route("/by-name/<name>", methods=["GET"])
def get_public_bot_by_name(name):
    bot = BotService.get_active_bot_by_name(name)
    if not bot:
        return jsonify({"error": "Bot not found"}), 404
    return jsonify(bot_schema.dump(bot)), 200


@public_bots_bp.route("/search", methods=["POST"])
def search_public_bots():
    data = request.get_json() or {}
    query = (data.get("query") or "").strip()
    if not query:
        return jsonify({"error": "query is required"}), 400
    bots = BotService.search_active_bots(query)
    return jsonify(bots_schema.dump(bots)), 200


@public_bots_bp.route("/<bot_id>/token", methods=["POST"])
@api_key_required
def generate_public_bot_token(current_user, bot_id):
    token, error = BotService.generate_bot_token(bot_id)
    if error:
        return jsonify({"error": error}), 400
    return jsonify({"bot_token": token}), 200


@public_bots_bp.route("/<bot_id>/updates", methods=["GET"])
def get_bot_updates(bot_id):
    try:
        _, error_response = _verify_bot_token(bot_id)
        if error_response:
            logger.info("bot_updates_auth_failed bot_id=%s", bot_id)
            return error_response

        offset = request.args.get("offset", 0, type=int)
        limit = request.args.get("limit", 100, type=int)
        timeout = request.args.get("timeout", 20, type=int)
        if limit < 1:
            limit = 1
        if limit > 100:
            limit = 100
        if timeout < 0:
            timeout = 0
        if timeout > 2:
            timeout = 2

        queue_name = f"updates:{bot_id}"

        def _fetch_updates():
            return _redis_pop_matching(
                queue_name,
                lambda u: int(u.get("update_id", 0)) > offset,
            )

        updates = _fetch_updates()
        # Limit results
        if len(updates) > limit:
            # Put extras back
            for item in updates[limit:]:
                _redis_push(queue_name, item)
            updates = updates[:limit]

        if updates:
            logger.info(
                "bot_updates_delivered bot_id=%s count=%s offset=%s",
                bot_id, len(updates), offset,
            )
            return jsonify({"items": updates}), 200

        # Long-poll
        start = time.time()
        while time.time() - start < timeout:
            time.sleep(0.3)
            updates = _fetch_updates()
            if len(updates) > limit:
                for item in updates[limit:]:
                    _redis_push(queue_name, item)
                updates = updates[:limit]
            if updates:
                logger.info(
                    "bot_updates_delivered bot_id=%s count=%s offset=%s",
                    bot_id, len(updates), offset,
                )
                return jsonify({"items": updates}), 200

        logger.info(
            "bot_updates_timeout bot_id=%s offset=%s timeout=%s",
            bot_id, offset, timeout,
        )
        return jsonify({"items": []}), 200
    except Exception as e:
        logger.exception("bot_updates_error bot_id=%s error=%s", bot_id, e)
        return jsonify({"error": "Internal server error"}), 500


@public_bots_bp.route("/<bot_id>/updates/push", methods=["POST"])
def push_bot_update(bot_id):
    try:
        _, error_response = _verify_bot_token(bot_id)
        if error_response:
            logger.info("bot_updates_push_auth_failed bot_id=%s", bot_id)
            return error_response
        data = request.get_json() or {}
        message = data.get("message") or {}
        text = message.get("text")
        from_user = message.get("from_user") or {}
        chat = message.get("chat") or {}
        # Allow media-only messages (photo, video, voice, etc.) without text
        has_media = any(message.get(k) for k in [
            "photo", "video", "voice", "audio", "document",
            "sticker", "location", "venue", "contact", "poll", "dice",
        ])
        if not text and not has_media:
            logger.info("bot_updates_push_missing_content bot_id=%s", bot_id)
            return jsonify({"error": "message.text or media content is required"}), 400
        if not from_user.get("id"):
            logger.info("bot_updates_push_missing_from_user bot_id=%s", bot_id)
            return jsonify({"error": "message.from_user.id is required"}), 400
        if not chat.get("id"):
            logger.info("bot_updates_push_missing_chat bot_id=%s", bot_id)
            return jsonify({"error": "message.chat.id is required"}), 400
        update_id = _redis_next_id()
        # Forward the FULL message dict — all content types (text, photo, video,
        # voice, audio, document, sticker, location, venue, contact, poll, dice)
        update_message = dict(message)
        update_message["message_id"] = str(update_id)
        update_message["from"] = {
            "id": str(from_user.get("id")),
            "username": from_user.get("username"),
            "avatar_url": from_user.get("avatar_url"),
        }
        update_message["chat"] = {
            "id": str(chat.get("id")),
            "type": chat.get("type") or "private",
            "title": chat.get("title"),
        }
        if "date" not in update_message:
            update_message["date"] = int(time.time())

        update = {
            "update_id": str(update_id),
            "message": update_message,
        }
        _redis_push(f"updates:{bot_id}", update)
        logger.info(
            "bot_updates_pushed bot_id=%s update_id=%s chat_id=%s from_user_id=%s",
            bot_id,
            update_id,
            chat.get("id"),
            from_user.get("id"),
        )
        return jsonify({"ok": True, "update_id": update_id}), 200
    except Exception as e:
        logger.exception(
            "bot_updates_push_error bot_id=%s error=%s", bot_id, e)
        return jsonify({"error": "Internal server error"}), 500


@public_bots_bp.route("/<bot_id>/send", methods=["POST"])
def send_bot_message(bot_id):
    """Send a bot message. Accepts ALL content types: text, photo, video, document,
    audio, voice, video_note, sticker, location, venue, contact, poll, dice, game.
    Each type is stored as a JSON object in the outbox for the frontend to render."""
    try:
        _, error_response = _verify_bot_token(bot_id)
        if error_response:
            logger.info("bot_send_auth_failed bot_id=%s", bot_id)
            return error_response
        data = request.get_json() or {}
        chat_id = data.get("chat_id")
        if not chat_id:
            logger.info("bot_send_missing_chat_id bot_id=%s", bot_id)
            return jsonify({"error": "chat_id is required"}), 400

        # Extract all content types
        text = data.get("text")
        reply_markup = data.get("reply_markup")
        game = data.get("game")
        photo = data.get("photo")
        video = data.get("video")
        document = data.get("document")
        audio = data.get("audio")
        voice = data.get("voice")
        video_note = data.get("video_note")
        sticker = data.get("sticker")
        location = data.get("location")
        venue = data.get("venue")
        contact = data.get("contact")
        poll = data.get("poll")
        dice = data.get("dice")
        caption = data.get("caption")

        # Determine content type and display text
        content_type = "text"
        display_text = text or ""
        if game:
            content_type = "game"
            from app.services.bot_game_service import BotGameService
            game_id = game.get("id") or game.get("game_id")
            row = (
                BotGameService.get_game(bot_id, str(game_id))
                if game_id
                else None
            )
            if not row or not row.is_published or row.scan_status != "approved":
                return jsonify({"error": "Игра недоступна"}), 400
            game = {
                "id": row.id,
                "title": row.title,
                "embed_url": f"/api/v1/bots/{bot_id}/games/{row.id}/embed",
                "download_url": f"/api/v1/bots/{bot_id}/games/{row.id}/download",
            }
            display_text = game.get("title", "")
        elif photo:
            content_type = "photo"
            display_text = caption or "[Фото]"
        elif video:
            content_type = "video"
            display_text = caption or "[Видео]"
        elif document:
            content_type = "document"
            fname = document.get("file_name", "документ") if isinstance(document, dict) else "документ"
            display_text = caption or f"[Документ: {fname}]"
        elif audio:
            content_type = "audio"
            title = audio.get("title", "") if isinstance(audio, dict) else ""
            display_text = caption or (f"[Аудио: {title}]" if title else "[Аудио]")
        elif voice:
            content_type = "voice"
            display_text = "[Голосовое сообщение]"
        elif video_note:
            content_type = "video_note"
            display_text = "[Видеосообщение]"
        elif sticker:
            content_type = "sticker"
            emoji = sticker.get("emoji", "") if isinstance(sticker, dict) else ""
            display_text = emoji or "[Стикер]"
        elif location:
            content_type = "location"
            display_text = "[Местоположение]"
        elif venue:
            content_type = "venue"
            vtitle = venue.get("title", "") if isinstance(venue, dict) else ""
            display_text = vtitle or "[Место]"
        elif contact:
            content_type = "contact"
            cname = contact.get("first_name", "") if isinstance(contact, dict) else ""
            display_text = cname or "[Контакт]"
        elif poll:
            content_type = "poll"
            question = poll.get("question", "") if isinstance(poll, dict) else ""
            display_text = question or "[Опрос]"
        elif dice:
            content_type = "dice"
            emoji = dice.get("emoji", "") if isinstance(dice, dict) else ""
            display_text = emoji or "[Кубик]"

        if not text and content_type == "text":
            logger.info("bot_send_missing_content bot_id=%s", bot_id)
            return jsonify({"error": "text or other content type is required"}), 400

        with OUTBOX_LOCK:
            OUTBOX_COUNTERS[bot_id] += 1
            message_id = OUTBOX_COUNTERS[bot_id]
            message_data = {
                "message_id": str(message_id),
                "chat_id": str(chat_id),
                "text": display_text,
                "type": content_type,
                "date": int(time.time()),
            }
            if game:
                message_data["game"] = game
            if photo:
                message_data["photo"] = photo
            if video:
                message_data["video"] = video
            if document:
                message_data["document"] = document
            if audio:
                message_data["audio"] = audio
            if voice:
                message_data["voice"] = voice
            if video_note:
                message_data["video_note"] = video_note
            if sticker:
                message_data["sticker"] = sticker
            if location:
                message_data["location"] = location
            if venue:
                message_data["venue"] = venue
            if contact:
                message_data["contact"] = contact
            if poll:
                message_data["poll"] = poll
            if dice:
                message_data["dice"] = dice
            if caption:
                message_data["caption"] = caption
            if reply_markup:
                message_data["reply_markup"] = reply_markup
            _redis_push(f"outbox:{bot_id}", message_data)
        logger.info(
            "bot_send_queued bot_id=%s message_id=%s chat_id=%s type=%s",
            bot_id,
            message_id,
            chat_id,
            content_type,
        )
        return jsonify(
            {"ok": True, "chat_id": str(chat_id), "type": content_type, "text": display_text}), 200
    except Exception as e:
        logger.exception("bot_send_error bot_id=%s error=%s", bot_id, e)
        return jsonify({"error": "Internal server error"}), 500


@public_bots_bp.route("/<bot_id>/callback", methods=["POST"])
def handle_bot_callback(bot_id):
    try:
        data = request.get_json() or {}
        message_id = data.get("message_id")
        callback_data = data.get("data") or data.get("text")
        user_id = data.get("user_id")
        chat_id = data.get("chat_id") or user_id

        logger.info(
            "bot_callback_received bot_id=%s message_id=%s data=%s user_id=%s chat_id=%s",
            bot_id,
            message_id,
            callback_data,
            user_id,
            chat_id,
        )

        if callback_data:
            from app.api.public.v1.bots import OUTBOX_LOCK, OUTBOX_QUEUES, OUTBOX_COUNTERS, QUEUE_LOCK, UPDATE_QUEUES, UPDATE_COUNTERS
            import time

            ui_only = (
                str(callback_data).startswith("ui:")
                or str(callback_data).startswith("games:")
                or str(callback_data).startswith("game:")
            )

            if not ui_only:
                with OUTBOX_LOCK:
                    callback_message_id = _redis_counter_incr("outbox", bot_id)

            with QUEUE_LOCK:
                update_id = _redis_next_id()

                update = {
                    "update_id": str(update_id),
                    "message": {
                        "message_id": str(update_id),
                        "from": {"id": str(user_id)},
                        "chat": {"id": str(chat_id)},
                        "text": callback_data,
                        "date": int(time.time()),
                    },
                }

                # Add callback_query ONLY for inline buttons (when 'data' field was used)
                has_data_field = (data.get("data") is not None)
                if has_data_field:
                    update["callback_query"] = {
                        "id": str(update_id),
                        "from": {"id": str(user_id)},
                        "message": {
                            "message_id": str(message_id or update_id),
                            "chat": {"id": str(chat_id)},
                        },
                        "data": callback_data,
                    }

                _redis_push(f"updates:{bot_id}", update)

            logger.info(
                "bot_callback_processed bot_id=%s chat_id=%s update_id=%s",
                bot_id,
                chat_id,
                update_id
            )

        return jsonify({"ok": True}), 200
    except Exception as e:
        logger.exception("bot_callback_error bot_id=%s error=%s", bot_id, e)
        return jsonify({"error": "Internal server error"}), 500


@public_bots_bp.route("/<bot_id>/answerCallbackQuery", methods=["POST"])
@public_bots_bp.route("/<bot_id>/answer-callback-query", methods=["POST"])
def answer_callback_query(bot_id):
    """Compatibility endpoint for Bot API clients that acknowledge callbacks."""
    try:
        _, error_response = _verify_bot_token(bot_id)
        if error_response:
            logger.info("bot_answer_callback_auth_failed bot_id=%s", bot_id)
            return error_response

        data = request.get_json() or {}
        callback_query_id = data.get("callback_query_id") or data.get("id")
        logger.info(
            "bot_answer_callback_ok bot_id=%s callback_query_id=%s",
            bot_id,
            callback_query_id,
        )
        return jsonify({"ok": True}), 200
    except Exception as e:
        logger.exception(
            "bot_answer_callback_error bot_id=%s error=%s",
            bot_id,
            e)
        return jsonify({"error": "Internal server error"}), 500


@public_bots_bp.route("/<bot_id>/games", methods=["GET"])
def list_bot_games_public(bot_id):
    """Список опубликованных игр бота (Bot token)."""
    try:
        _, error_response = _verify_bot_token(bot_id)
        if error_response:
            return error_response
        from app.services.bot_game_service import BotGameService

        query = request.args.get("q") or request.args.get("query")
        games = BotGameService.list_games(
            bot_id, query=query, published_only=True
        )
        return jsonify(
            {
                "games": [
                    {
                        "id": g.id,
                        "title": g.title,
                        "description": g.description,
                    }
                    for g in games
                ],
                "bot_id": bot_id,
            }
        ), 200
    except Exception as e:
        logger.exception("bot_list_games_error bot_id=%s error=%s", bot_id, e)
        return jsonify({"error": "Internal server error"}), 500


# ── Bot permissions (consent) ────────────────────────────────────────

@public_bots_bp.route("/<bot_id>/permissions/<user_id>", methods=["GET"])
def check_bot_permissions(bot_id, user_id):
    """Check if a user has granted permissions to a bot."""
    try:
        _, error_response = _verify_bot_token(bot_id)
        if error_response:
            return error_response
        from app.services.bot_permission_service import BotPermissionService
        scopes = BotPermissionService.get_user_scopes(bot_id, user_id)
        return jsonify({
            "granted": bool(scopes),
            "scopes": scopes.split(",") if scopes else [],
        }), 200
    except Exception as e:
        logger.exception("bot_permissions_check_error bot_id=%s error=%s", bot_id, e)
        return jsonify({"error": "Internal server error"}), 500


@public_bots_bp.route("/<bot_id>/permissions/grant", methods=["POST"])
def bot_permissions_grant(bot_id):
    """Grant permissions — called by bot itself or user."""
    try:
        _, error_response = _verify_bot_token(bot_id)
        if error_response:
            return error_response
        data = request.get_json() or {}
        user_id = data.get("user_id")
        scopes = data.get("scopes", "basic_profile,send_messages")
        if not user_id:
            return jsonify({"error": "user_id is required"}), 400
        from app.services.bot_permission_service import BotPermissionService
        perm = BotPermissionService.grant_scopes(bot_id, user_id, scopes)
        return jsonify({"ok": True, "scopes": perm.scopes}), 200
    except Exception as e:
        logger.exception("bot_permissions_grant_error bot_id=%s error=%s", bot_id, e)
        return jsonify({"error": "Internal server error"}), 500


@public_bots_bp.route("/<bot_id>/permissions/check", methods=["POST"])
def batch_check_permissions(bot_id):
    """Batch check permissions for multiple users."""
    try:
        _, error_response = _verify_bot_token(bot_id)
        if error_response:
            return error_response
        data = request.get_json() or {}
        user_ids = data.get("user_ids", [])
        from app.services.bot_permission_service import BotPermissionService
        result = BotPermissionService.batch_check(bot_id, user_ids)
        return jsonify({"permissions": result}), 200
    except Exception as e:
        logger.exception("bot_permissions_batch_error bot_id=%s error=%s", bot_id, e)
        return jsonify({"error": "Internal server error"}), 500


@public_bots_bp.route("/<bot_id>/consent", methods=["GET"])
def bot_consent_page(bot_id):
    """Render consent page for bot permissions (analogous to OAuth authorize)."""
    try:
        bot = BotService.get_active_bot_by_id(bot_id)
        if not bot:
            return jsonify({"error": "Bot not found"}), 404

        scopes_param = request.args.get("scopes", "basic_profile,send_messages")
        redirect = request.args.get("redirect", "/feed/messages")
        user_id = request.args.get("user_id", "")
        scopes = scopes_param.split(",")
        scopes_desc = {
            "basic_profile": "Basic profile (ID, username, avatar)",
            "read_profile": "Read full profile (name, email, bio)",
            "chat_access": "Access to chat list",
            "message_history": "Read message history",
            "send_messages": "Send messages",
            "media_access": "Send photos, videos, documents",
            "location_access": "Read geolocation",
            "notifications": "Push notifications",
        }

        from flask import make_response
        html = f"""<!DOCTYPE html>
<html lang="ru">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{bot.name} — Consent</title>
<style>
*{{margin:0;padding:0;box-sizing:border-box}}
body{{font-family:-apple-system,BlinkMacSystemFont,sans-serif;background:#0f0f23;color:#e0e0e0;
display:flex;justify-content:center;align-items:center;min-height:100vh;padding:20px}}
.card{{background:#1a1a2e;border-radius:16px;padding:32px;max-width:420px;width:100%;
border:1px solid rgba(255,255,255,.1);box-shadow:0 8px 32px rgba(0,0,0,.4)}}
.bot-info{{text-align:center;margin-bottom:24px}}
.bot-name{{font-size:22px;font-weight:700;color:#fff;margin:12px 0 4px}}
.bot-desc{{color:#888;font-size:14px}}
.scope-list{{list-style:none;margin:16px 0;padding:0}}
.scope-list li{{padding:10px 0;border-bottom:1px solid rgba(255,255,255,.05);font-size:14px;color:#ccc}}
.scope-list li::before{{content:'✓ ';color:#4ade80;font-weight:700}}
.btn-row{{display:flex;gap:12px;margin-top:24px}}
.btn{{flex:1;padding:12px;border:none;border-radius:10px;font-size:15px;font-weight:600;cursor:pointer}}
.btn-allow{{background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff}}
.btn-deny{{background:rgba(255,255,255,.08);color:#999}}
.btn-allow:hover{{opacity:.9}}
.btn-deny:hover{{background:rgba(255,255,255,.12)}}
</style></head>
<body><div class="card">
<div class="bot-info">
  <div class="bot-name">{bot.name}</div>
  <div class="bot-desc">{bot.description or 'Bot on Vontic'}</div>
</div>
<p style="color:#aaa;font-size:13px;text-align:center">This bot requests the following permissions:</p>
<ul class="scope-list">
{''.join(f"<li>{scopes_desc.get(s, s)}</li>" for s in scopes)}
</ul>
<form method="POST" action="/api/public/v1/bots/{bot_id}/consent/grant">
  <input type="hidden" name="user_id" value="{user_id}">
  <input type="hidden" name="scopes" value="{scopes_param}">
  <input type="hidden" name="redirect" value="{redirect}">
  <div class="btn-row">
    <button type="submit" name="action" value="deny" class="btn btn-deny">Deny</button>
    <button type="submit" name="action" value="allow" class="btn btn-allow">Allow</button>
  </div>
</form>
</div></body></html>"""
        resp = make_response(html)
        resp.headers["Content-Type"] = "text/html; charset=utf-8"
        return resp
    except Exception as e:
        logger.exception("bot_consent_error bot_id=%s error=%s", bot_id, e)
        return jsonify({"error": "Internal server error"}), 500


@public_bots_bp.route("/<bot_id>/consent/grant", methods=["POST"])
def bot_consent_grant(bot_id):
    """Process consent grant/deny."""
    try:
        action = request.form.get("action", "deny")
        user_id = request.form.get("user_id", "")
        scopes = request.form.get("scopes", "")
        redirect = request.form.get("redirect", "/feed/messages")

        if action == "allow" and user_id:
            from app.services.bot_permission_service import BotPermissionService
            BotPermissionService.grant_scopes(bot_id, user_id, scopes)
            return jsonify({"ok": True, "action": "granted", "scopes": scopes}), 200
        else:
            return jsonify({"ok": True, "action": "denied"}), 200
    except Exception as e:
        logger.exception("bot_consent_grant_error bot_id=%s error=%s", bot_id, e)
        return jsonify({"error": "Internal server error"}), 500
