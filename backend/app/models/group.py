import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, String, Table, Text
from sqlalchemy.orm import backref, relationship
from app.core.database import Base

group_participants = Table(
    "group_participants",
    Base.metadata,
    Column("user_id", Text, ForeignKey("users.id"), primary_key=True),
    Column("group_id", Text, ForeignKey("groups.id"), primary_key=True),
    Column("joined_at", DateTime, default=datetime.utcnow),
)


class Group(Base):
    __tablename__ = "groups"

    id = Column(Text, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(Text, nullable=False)
    description = Column(Text, nullable=True)
    avatar_url = Column(Text, nullable=True)
    invite_code = Column(Text, unique=True, default=lambda: str(uuid.uuid4())[:8])
    owner_id = Column(Text, ForeignKey("users.id"), nullable=False)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    owner = relationship("User", foreign_keys=[owner_id], backref="owned_groups")
    participants = relationship(
        "User",
        secondary=group_participants,
        lazy="subquery",
        backref=backref("groups", lazy=True),
    )

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "avatar_url": self.avatar_url,
            "invite_code": self.invite_code,
            "owner_id": self.owner_id,
            "participants_count": len(self.participants) if self.participants else 0,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
