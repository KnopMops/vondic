import json
import logging
import os
import time
from datetime import datetime, timedelta

import requests
from google.auth.transport.requests import Request
from google.oauth2 import service_account

logger = logging.getLogger(__name__)

SCOPES = ["https://www.googleapis.com/auth/firebase.messaging"]
SERVICE_ACCOUNT_FILE = os.environ.get(
    "FCM_SERVICE_ACCOUNT_FILE",
    os.path.join(os.path.dirname(__file__), "..", "fcm-service-account.json"),
)

_cached_token = None
_cached_token_expiry = None


def _get_access_token():
    global _cached_token, _cached_token_expiry
    if _cached_token and _cached_token_expiry and datetime.utcnow() < _cached_token_expiry:
        return _cached_token
    try:
        creds = service_account.Credentials.from_service_account_file(
            SERVICE_ACCOUNT_FILE, scopes=SCOPES
        )
        creds.refresh(Request())
        _cached_token = creds.token
        _cached_token_expiry = datetime.utcnow() + timedelta(minutes=50)
        return _cached_token
    except Exception as e:
        logger.error("Failed to get FCM access token: %s", e)
        return None


def send_push_notification(device_token: str, title: str, body: str, data: dict | None = None):
    access_token = _get_access_token()
    if not access_token:
        logger.error("Cannot send push: no access token")
        return
    url = f"https://fcm.googleapis.com/v1/projects/vondic-push/messages:send"
    payload = {
        "message": {
            "token": device_token,
            "notification": {
                "title": title,
                "body": body,
            },
            "data": data or {},
            "android": {
                "notification": {
                    "sound": "message",
                },
            },
            "apns": {
                "payload": {
                    "aps": {
                        "sound": "message",
                    },
                },
            },
        }
    }
    try:
        resp = requests.post(
            url,
            json=payload,
            headers={"Authorization": f"Bearer {access_token}"},
            timeout=10,
        )
        if not resp.ok:
            logger.error("FCM send failed: %s %s", resp.status_code, resp.text[:200])
    except Exception as e:
        logger.error("FCM send error: %s", e)


def send_call_wake(device_token: str, call_data: dict):
    access_token = _get_access_token()
    if not access_token:
        logger.error("Cannot send call push: no access token")
        return
    url = f"https://fcm.googleapis.com/v1/projects/vondic-push/messages:send"
    payload = {
        "message": {
            "token": device_token,
            "data": {
                "type": "incoming_call",
                **call_data,
            },
            "android": {
                "priority": "high",
            },
        }
    }
    try:
        resp = requests.post(
            url,
            json=payload,
            headers={"Authorization": f"Bearer {access_token}"},
            timeout=10,
        )
        if not resp.ok:
            logger.error("FCM call wake failed: %s %s", resp.status_code, resp.text[:200])
    except Exception as e:
        logger.error("FCM call wake error: %s", e)
