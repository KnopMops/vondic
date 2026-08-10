import uuid
from datetime import datetime
from sqlalchemy import Column, DateTime, ForeignKey, String, Text
from app.core.database import Base


class JoinRequest(Base):
    __tablename__ = "join_requests"

    id = Column(Text, primary_key=True, default=lambda: str(uuid.uuid4()))
    target_type = Column(Text, nullable=False)  # group, channel, community
    target_id = Column(Text, nullable=False)
    user_id = Column(Text, ForeignKey("users.id"), nullable=False)
    status = Column(Text, default="pending")  # pending, approved, declined
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "target_type": self.target_type,
            "target_id": self.target_id,
            "user_id": self.user_id,
            "status": self.status,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
