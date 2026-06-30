import logging
import os

import requests as http_requests

logger = logging.getLogger(__name__)

NOVU_API_URL = os.environ.get("NOVU_API_URL", "")
NOVU_API_KEY = os.environ.get("NOVU_API_KEY", "")


class NovuPushService:
    @staticmethod
    def _headers():
        return {
            "Authorization": f"ApiKey {NOVU_API_KEY}",
            "Content-Type": "application/json",
        }

    @staticmethod
    def _trigger_event(event_name: str, subscriber_id: str, payload: dict):
        if not NOVU_API_URL or not NOVU_API_KEY:
            return
        url = f"{NOVU_API_URL}/v1/events/trigger"
        body = {
            "name": event_name,
            "to": [{"subscriberId": subscriber_id}],
            "payload": payload,
        }
        try:
            resp = http_requests.post(url, json=body, headers=NovuPushService._headers(), timeout=10)
            if not resp.ok:
                logger.error("Novu trigger failed: %s %s", resp.status_code, resp.text[:200])
        except Exception as e:
            logger.error("Novu trigger error: %s", e)

    @staticmethod
    def send_notification(user_id: str, title: str, body: str, data: dict | None = None):
        NovuPushService._trigger_event("push-message", user_id, {
            "title": title,
            "body": body,
            "sound": "message",
            **(data or {}),
        })

    @staticmethod
    def send_call_wake(user_id: str, call_data: dict):
        NovuPushService._trigger_event("push-call", user_id, {
            "type": "incoming_call",
            **call_data,
        })
