import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import relationship
from app.core.database import Base


class Subscription(Base):
    __tablename__ = "subscriptions"
    id = Column(Text, primary_key=True, default=lambda: str(uuid.uuid4()))
    subscriber_id = Column(Text, ForeignKey("users.id"), nullable=False)
    target_id = Column(Text, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint("subscriber_id", "target_id", name="uq_subscription"),
    )

    subscriber = relationship(
        "User", foreign_keys=[subscriber_id], backref="following_subscriptions"
    )
    target = relationship(
        "User", foreign_keys=[target_id], backref="follower_subscriptions"
    )

    def to_dict(self):
        return {
            "id": self.id,
            "subscriber_id": self.subscriber_id,
            "target_id": self.target_id,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
