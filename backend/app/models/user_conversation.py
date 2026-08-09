import uuid
from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, String, Text, UniqueConstraint
from app.core.database import Base


class UserConversation(Base):
    __tablename__ = "user_conversations"

    id = Column(Text, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(Text, ForeignKey("users.id"), nullable=False)
    partner_id = Column(Text, ForeignKey("users.id"), nullable=False)
    is_secret = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint("user_id", "partner_id", name="uq_user_conversation"),
    )

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "partner_id": self.partner_id,
            "is_secret": bool(self.is_secret),
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
