import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, String, Table, Text, Boolean
from sqlalchemy.orm import backref, relationship
from app.core.database import Base

community_members = Table(
    "community_members",
    Base.metadata,
    Column("user_id", Text, ForeignKey("users.id"), primary_key=True),
    Column("community_id", Text, ForeignKey("communities.id"), primary_key=True),
    Column("joined_at", DateTime, default=datetime.utcnow),
)


class Community(Base):
    __tablename__ = "communities"

    id = Column(Text, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(Text, nullable=False)
    description = Column(Text, nullable=True)
    avatar_url = Column(Text, nullable=True)
    invite_code = Column(Text, unique=True, default=lambda: str(uuid.uuid4())[:8])
    owner_id = Column(Text, ForeignKey("users.id"), nullable=False)
    require_approval = Column(Boolean, default=False)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    owner = relationship(
        "User", foreign_keys=[owner_id], backref="owned_communities"
    )
    members = relationship(
        "User",
        secondary=community_members,
        lazy="subquery",
        backref=backref("communities", lazy=True),
    )

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "avatar_url": self.avatar_url,
            "invite_code": self.invite_code,
            "owner_id": self.owner_id,
            "require_approval": bool(getattr(self, "require_approval", False)),
            "members_count": len(self.members) if self.members else 0,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
