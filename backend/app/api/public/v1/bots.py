import time
from collections import defaultdict, deque
from threading import Lock

from app.schemas.bot_schema import bot_schema, bots_schema
from app.services.bot_service import BotService
from app.utils.decorators import api_key_required
from flask import Blueprint, jsonify, request

public_bots_bp = Blueprint(
    "public_bots", __name__, url_prefix="/api/public/v1/bots"
)

UPDATE_QUEUES = defaultdict(deque)
UPDATE_COUNTERS = defaultdict(int)
OUTBOX_QUEUES = defaultdict(deque)
OUTBOX_COUNTERS = defaultdict(int)
QUEUE_LOCK = Lock()
OUTBOX_LOCK = Lock()


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
    if not BotService.verify_bot_token(bot_id, token):
        return None, (jsonify({"error": "Invalid bot token"}), 401)
    return token, None


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
    _, error_response = _verify_bot_token(bot_id)
    if error_response:
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
    if timeout > 30:
        timeout = 30

    start = time.time()
    while True:
        with QUEUE_LOCK:
            queue = UPDATE_QUEUES[bot_id]
            while queue:
                first_id = int(queue[0].get("update_id", 0))
                if first_id <= offset:
                    queue.popleft()
                else:
                    break
            updates = []
            while queue and len(updates) < limit:
                updates.append(queue.popleft())
        if updates:
            return jsonify({"items": updates}), 200
        if time.time() - start >= timeout:
            return jsonify({"items": []}), 200
        time.sleep(0.2)


@public_bots_bp.route("/<bot_id>/updates/push", methods=["POST"])
def push_bot_update(bot_id):
    _, error_response = _verify_bot_token(bot_id)
    if error_response:
        return error_response
    data = request.get_json() or {}
    message = data.get("message") or {}
    text = message.get("text")
    from_user = message.get("from_user") or {}
    chat = message.get("chat") or {}
    if not text:
        return jsonify({"error": "message.text is required"}), 400
    if not from_user.get("id"):
        return jsonify({"error": "message.from_user.id is required"}), 400
    if not chat.get("id"):
        return jsonify({"error": "message.chat.id is required"}), 400
    with QUEUE_LOCK:
        UPDATE_COUNTERS[bot_id] += 1
        update_id = UPDATE_COUNTERS[bot_id]
        update = {
            "update_id": str(update_id),
            "message": {
                "message_id": str(update_id),
                "text": text,
                "from_user": {
                    "id": str(from_user.get("id")),
                    "username": from_user.get("username"),
                    "avatar_url": from_user.get("avatar_url"),
                },
                "chat": {
                    "id": str(chat.get("id")),
                    "type": chat.get("type") or "private",
                    "title": chat.get("title"),
                },
                "date": int(time.time()),
            },
        }
        UPDATE_QUEUES[bot_id].append(update)
    return jsonify({"ok": True, "update_id": update_id}), 200


@public_bots_bp.route("/<bot_id>/send", methods=["POST"])
def send_bot_message(bot_id):
    _, error_response = _verify_bot_token(bot_id)
    if error_response:
        return error_response
    data = request.get_json() or {}
    chat_id = data.get("chat_id")
    text = data.get("text")
    if not chat_id:
        return jsonify({"error": "chat_id is required"}), 400
    if not text:
        return jsonify({"error": "text is required"}), 400
    with OUTBOX_LOCK:
        OUTBOX_COUNTERS[bot_id] += 1
        message_id = OUTBOX_COUNTERS[bot_id]
        OUTBOX_QUEUES[bot_id].append(
            {
                "message_id": str(message_id),
                "chat_id": str(chat_id),
                "text": text,
                "date": int(time.time()),
            }
        )
    return jsonify({"ok": True, "chat_id": str(chat_id), "text": text}), 200
