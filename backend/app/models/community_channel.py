import uuid
from datetime import datetime

from sqlalchemy import CheckConstraint, Column, DateTime, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import backref, relationship
from app.core.database import Base


class CommunityChannel(Base):
    __tablename__ = "community_channels"

    id = Column(Text, primary_key=True, default=lambda: str(uuid.uuid4()))
    community_id = Column(Text, ForeignKey("communities.id"), nullable=False)
    name = Column(Text, nullable=False)
    description = Column(Text, nullable=True)
    type = Column(Text, nullable=False, default="text")

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint("community_id", "name", name="uq_community_channel_name"),
        CheckConstraint("type IN ('text','voice')", name="ck_channel_type"),
    )

    community = relationship(
        "Community",
        foreign_keys=[community_id],
        backref=backref("channels", lazy=True),
    )

    def to_dict(self):
        return {
            "id": self.id,
            "community_id": self.community_id,
            "name": self.name,
            "description": self.description,
            "type": self.type,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
