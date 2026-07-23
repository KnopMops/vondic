"""V2 Webhook subscriptions for bots."""
import uuid
import time
import hashlib
import hmac
import json
import logging
import os
import threading
from flask import Blueprint, request, jsonify
from app.api.public.v1.bots import _verify_bot_token
from app.api.v2.errors import validation_error, not_found

logger = logging.getLogger(__name__)

v2_webhooks_bp = Blueprint("v2_webhooks", __name__, url_prefix="/api/public/v2/bots")


def _get_redis():
    import redis as redis_mod
    return redis_mod.Redis(
        host=os.environ.get("REDIS_HOST", "redis"),
        port=int(os.environ.get("REDIS_PORT", 6379)),
        db=0, decode_responses=True,
    )


@v2_webhooks_bp.route("/<bot_id>/webhooks", methods=["GET"])
def list_webhooks(bot_id):
    """List all webhook subscriptions for a bot."""
    _, error_response = _verify_bot_token(bot_id)
    if error_response:
        return error_response

    r = _get_redis()
    webhook_ids = r.smembers(f"webhooks:{bot_id}") or set()
    webhooks = []
    for wid in webhook_ids:
        data = r.hgetall(f"webhook:{wid}")
        if data:
            data["id"] = wid
            data["events"] = data.get("events", "").split(",")
            webhooks.append(data)

    return jsonify({"webhooks": webhooks}), 200


@v2_webhooks_bp.route("/<bot_id>/webhooks", methods=["POST"])
def create_webhook(bot_id):
    """Create a new webhook subscription."""
    _, error_response = _verify_bot_token(bot_id)
    if error_response:
        return error_response

    data = request.get_json() or {}
    url = data.get("url", "")
    events = data.get("events", ["message"])
    secret = data.get("secret", "")

    if not url:
        return validation_error("url is required")
    if not url.startswith("http"):
        return validation_error("url must start with http:// or https://")
    if not events:
        return validation_error("events array is required")

    webhook_id = str(uuid.uuid4())[:12]
    r = _get_redis()

    r.hset(f"webhook:{webhook_id}", mapping={
        "id": webhook_id,
        "bot_id": bot_id,
        "url": url,
        "events": ",".join(events),
        "secret": secret,
        "is_active": "1",
        "created_at": str(int(time.time())),
    })
    r.sadd(f"webhooks:{bot_id}", webhook_id)

    logger.info("webhook_created bot_id=%s webhook_id=%s url=%s", bot_id, webhook_id, url)

    return jsonify({"ok": True, "webhook_id": webhook_id}), 201


@v2_webhooks_bp.route("/<bot_id>/webhooks/<webhook_id>", methods=["DELETE"])
def delete_webhook(bot_id, webhook_id):
    """Delete a webhook subscription."""
    _, error_response = _verify_bot_token(bot_id)
    if error_response:
        return error_response

    r = _get_redis()
    if not r.sismember(f"webhooks:{bot_id}", webhook_id):
        return not_found("Webhook not found")

    r.delete(f"webhook:{webhook_id}")
    r.srem(f"webhooks:{bot_id}", webhook_id)

    return jsonify({"ok": True}), 200


def deliver_webhook(bot_id, event_type, event_data):
    """Deliver a webhook event to all subscribed URLs."""
    try:
        r = _get_redis()
        webhook_ids = r.smembers(f"webhooks:{bot_id}") or set()

        for wid in webhook_ids:
            data = r.hgetall(f"webhook:{wid}")
            if not data or data.get("is_active") != "1":
                continue

            url = data.get("url", "")
            events = data.get("events", "").split(",")
            secret = data.get("secret", "")

            if event_type not in events and "*" not in events:
                continue

            # Deliver in background thread
            thread = threading.Thread(
                target=_deliver_single_webhook,
                args=(url, bot_id, event_type, event_data, secret),
                daemon=True,
            )
            thread.start()

    except Exception as e:
        logger.error("webhook_deliver_error bot_id=%s error=%s", bot_id, e)


def _deliver_single_webhook(url, bot_id, event_type, event_data, secret):
    """Deliver a single webhook with retry."""
    import requests as http_requests

    payload = {
        "event": event_type,
        "bot_id": bot_id,
        "timestamp": int(time.time()),
        "data": event_data,
    }

    headers = {"Content-Type": "application/json"}

    # Sign payload if secret is set
    if secret:
        body = json.dumps(payload, default=str)
        signature = hmac.new(secret.encode(), body.encode(), hashlib.sha256).hexdigest()
        headers["X-Webhook-Signature"] = f"sha256={signature}"

    for attempt in range(3):
        try:
            resp = http_requests.post(url, json=payload, headers=headers, timeout=5)
            if resp.status_code < 300:
                logger.info("webhook_delivered url=%s event=%s status=%d", url, event_type, resp.status_code)
                return
            logger.warning("webhook_failed url=%s status=%d attempt=%d", url, resp.status_code, attempt + 1)
        except Exception as e:
            logger.warning("webhook_error url=%s error=%s attempt=%d", url, e, attempt + 1)
        time.sleep(2 ** attempt)  # Exponential backoff: 1s, 2s, 4s

    logger.error("webhook_final_fail url=%s event=%s after 3 attempts", url, event_type)
