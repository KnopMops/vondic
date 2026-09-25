import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.orm import backref, relationship

from app.core.database import Base


class Passkey(Base):
    __tablename__ = "passkeys"

    id = Column(Text, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(Text, ForeignKey("users.id"), nullable=False, index=True)
    credential_id = Column(Text, unique=True, nullable=False, index=True)
    public_key = Column(Text, nullable=False)
    sign_count = Column(Integer, default=0)
    device_name = Column(Text, nullable=True)
    transports = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    last_used_at = Column(DateTime, nullable=True)

    user = relationship("User", backref=backref("passkeys", lazy="selectin", cascade="all, delete-orphan"))

    def to_dict(self):
        return {
            "id": self.id,
            "credential_id": self.credential_id[:16] + "...",
            "device_name": self.device_name or "Passkey",
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "last_used_at": self.last_used_at.isoformat() if self.last_used_at else None,
        }
