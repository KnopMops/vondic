import uuid
from datetime import datetime, timedelta

from sqlalchemy import TEXT, TIMESTAMP, ForeignKey

from app.core.extensions import db


class UserSession(db.Model):
    __tablename__ = "user_sessions"

    id = db.Column(TEXT, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = db.Column(TEXT, ForeignKey("users.id"), nullable=False, index=True)
    device_type = db.Column(TEXT, nullable=False, default="web")
    device_name = db.Column(TEXT, nullable=True)
    ip_address = db.Column(TEXT, nullable=True)
    access_token_lookup = db.Column(TEXT, unique=True, nullable=False, index=True)
    access_token_hash = db.Column(TEXT, nullable=False)
    refresh_token_lookup = db.Column(TEXT, unique=True, nullable=False, index=True)
    refresh_token_hash = db.Column(TEXT, nullable=False)
    created_at = db.Column(TIMESTAMP, default=datetime.utcnow)
    last_active = db.Column(TIMESTAMP, default=datetime.utcnow)
    expires_at = db.Column(TIMESTAMP, nullable=True)

    MAX_SESSIONS = 3
    WEB_SESSION_TTL = timedelta(days=7)

    def is_expired(self):
        if self.expires_at is None:
            return False
        return datetime.utcnow() > self.expires_at

    def to_dict(self):
        return {
            "id": self.id,
            "device_type": self.device_type,
            "device_name": self.device_name,
            "ip_address": self.ip_address,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "last_active": self.last_active.isoformat() if self.last_active else None,
            "expires_at": self.expires_at.isoformat() if self.expires_at else None,
        }
