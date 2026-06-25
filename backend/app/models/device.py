import uuid
from datetime import datetime

from sqlalchemy import TEXT, TIMESTAMP, ForeignKey

from app.core.extensions import db


class Device(db.Model):
    __tablename__ = "devices"

    id = db.Column(TEXT, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = db.Column(TEXT, ForeignKey("users.id"), nullable=False, index=True)
    token = db.Column(TEXT, unique=True, nullable=False, index=True)
    platform = db.Column(TEXT, nullable=False, default="android")
    device_type = db.Column(TEXT, nullable=False, default="mobile")
    created_at = db.Column(TIMESTAMP, default=datetime.utcnow)
    updated_at = db.Column(TIMESTAMP, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "token": self.token,
            "platform": self.platform,
            "device_type": self.device_type,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
