import logging
import os

import firebase_admin
from firebase_admin import credentials, messaging

logger = logging.getLogger(__name__)

_app = None


def _remove_stale_token(device_token: str):
    """Remove an invalid FCM token from the devices table."""
    try:
        from sqlalchemy import text
        from webrtc.database import UserRepository
        repo = UserRepository()
        with repo._session() as session:
            session.execute(
                text("DELETE FROM devices WHERE token = :token"),
                {"token": device_token},
            )
        logger.info("Removed stale FCM token: %s...", device_token[:20])
    except Exception as e:
        logger.error("Failed to remove stale token: %s", e)


def _get_firebase_app():
    global _app
    if _app:
        return _app
    service_account_file = os.environ.get(
        "FCM_SERVICE_ACCOUNT_FILE",
        os.path.join(os.path.dirname(__file__), "..", "fcm-service-account.json"),
    )
    if not os.path.exists(service_account_file):
        logger.error("FCM service account file not found: %s", service_account_file)
        return None
    try:
        cred = credentials.Certificate(service_account_file)
        _app = firebase_admin.initialize_app(cred)
        logger.info("Firebase Admin initialized successfully")
        return _app
    except Exception as e:
        logger.error("Failed to initialize Firebase Admin: %s", e)
        return None


def send_push_notification(device_token: str, title: str, body: str, data: dict | None = None):
    app = _get_firebase_app()
    if not app:
        return
    message = messaging.Message(
        token=device_token,
        notification=messaging.Notification(title=title, body=body),
        data=data or {},
        android=messaging.AndroidConfig(
            notification=messaging.AndroidNotification(sound="message"),
        ),
        apns=messaging.APNSConfig(
            payload=messaging.APNSPayload(
                aps=messaging.Aps(sound="message"),
            ),
        ),
    )
    try:
        response = messaging.send(message, app=app)
        logger.info("FCM sent to %s: %s", device_token[:20], response)
    except messaging.UnregisteredError:
        _remove_stale_token(device_token)
    except Exception as e:
        logger.error("FCM send error: %s", e)


def send_call_wake(device_token: str, call_data: dict):
    app = _get_firebase_app()
    if not app:
        return

    payload_data = {"type": "incoming_call"}
    for k, v in call_data.items():
        if v is not None:
            payload_data[str(k)] = str(v)

    message = messaging.Message(
        token=device_token,
        data=payload_data,
        android=messaging.AndroidConfig(
            priority="high",
        ),
    )
    try:
        response = messaging.send(message, app=app)
        logger.info("FCM call wake sent to %s: %s", device_token[:20], response)
    except messaging.UnregisteredError:
        _remove_stale_token(device_token)
    except Exception as e:
        logger.error("FCM call wake error: %s", e)
