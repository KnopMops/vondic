import logging

from app.services.fcm_push import send_push_notification, send_call_wake

logger = logging.getLogger(__name__)


class FCMService:
    @staticmethod
    def send_notification(user_id: str, title: str, body: str, data: dict | None = None):
        from app.models.device import Device
        devices = Device.query.filter_by(user_id=str(user_id)).all()
        for dev in devices:
            send_push_notification(dev.token, title, body, data)

    @staticmethod
    def send_call_wake(user_id: str, call_data: dict):
        from app.models.device import Device
        devices = Device.query.filter_by(user_id=str(user_id)).all()
        for dev in devices:
            send_call_wake(dev.token, call_data)
