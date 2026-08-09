import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import relationship
from app.core.database import Base


class Friendship(Base):
    __tablename__ = "friendships"
    id = Column(Text, primary_key=True, default=lambda: str(uuid.uuid4()))
    requester_id = Column(Text, ForeignKey("users.id"), nullable=False)
    addressee_id = Column(Text, ForeignKey("users.id"), nullable=False)
    status = Column(Text, default="pending")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint("requester_id", "addressee_id", name="uq_friendship_request"),
    )

    requester = relationship(
        "User", foreign_keys=[requester_id], backref="sent_friend_requests"
    )
    addressee = relationship(
        "User", foreign_keys=[addressee_id], backref="friendships"
    )

    def to_dict(self):
        return {
            "id": self.id,
            "requester_id": self.requester_id,
            "addressee_id": self.addressee_id,
            "status": self.status,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
