import uuid
from datetime import datetime, timedelta

from sqlalchemy import Column, DateTime, ForeignKey, String, Text
from app.core.database import Base


class UserSession(Base):
    __tablename__ = "user_sessions"

    id = Column(Text, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(Text, ForeignKey("users.id"), nullable=False, index=True)
    device_type = Column(Text, nullable=False, default="web")
    device_name = Column(Text, nullable=True)
    ip_address = Column(Text, nullable=True)
    access_token_lookup = Column(Text, unique=True, nullable=False, index=True)
    access_token_hash = Column(Text, nullable=False)
    refresh_token_lookup = Column(Text, unique=True, nullable=False, index=True)
    refresh_token_hash = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    last_active = Column(DateTime, default=datetime.utcnow)
    expires_at = Column(DateTime, nullable=True)

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
