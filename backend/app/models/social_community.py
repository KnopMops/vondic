import uuid
from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, String, Table, Text
from sqlalchemy.orm import backref, relationship
from app.core.database import Base

social_community_members = Table(
    "social_community_members",
    Base.metadata,
    Column("user_id", Text, ForeignKey("users.id"), primary_key=True),
    Column("social_community_id", Text, ForeignKey("social_communities.id"), primary_key=True),
    Column("role", Text, nullable=False, default="member"),
    Column("joined_at", DateTime, default=datetime.utcnow),
)


class SocialCommunity(Base):
    """Публичное сообщество (страница/группа как во VK), не сервер мессенджера."""

    __tablename__ = "social_communities"

    id = Column(Text, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(Text, nullable=False)
    description = Column(Text, nullable=True)
    avatar_url = Column(Text, nullable=True)
    cover_url = Column(Text, nullable=True)
    invite_code = Column(Text, unique=True, default=lambda: str(uuid.uuid4())[:8])
    is_public = Column(Boolean, default=True)
    owner_id = Column(Text, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    owner = relationship(
        "User", foreign_keys=[owner_id], backref="owned_social_communities"
    )
    members = relationship(
        "User",
        secondary=social_community_members,
        lazy="subquery",
        backref=backref("social_communities", lazy=True),
    )

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "avatar_url": self.avatar_url,
            "cover_url": self.cover_url,
            "invite_code": self.invite_code,
            "is_public": bool(self.is_public),
            "owner_id": self.owner_id,
            "members_count": len(self.members) if self.members else 0,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
