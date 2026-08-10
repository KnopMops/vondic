import uuid
from datetime import datetime

from sqlalchemy import Table, Column, ForeignKey, TEXT, TIMESTAMP, CheckConstraint
from sqlalchemy.orm import relationship, backref

from app.core.database import Base

channel_participants = Table(
    "channel_participants",
    Base.metadata,
    Column("user_id", TEXT, ForeignKey("users.id"), primary_key=True),
    Column("channel_id", TEXT, ForeignKey("channels.id"), primary_key=True),
    Column("joined_at", TIMESTAMP, default=datetime.utcnow),
)


class Channel(Base):
    __tablename__ = "channels"

    id = Column(TEXT, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(TEXT, nullable=False)
    description = Column(TEXT, nullable=True)
    avatar_url = Column(TEXT, nullable=True)
    invite_code = Column(
        TEXT, unique=True, default=lambda: str(uuid.uuid4())[:8])
    owner_id = Column(TEXT, ForeignKey("users.id"), nullable=False)
    type = Column(TEXT, nullable=False, default="text")

    created_at = Column(TIMESTAMP, default=datetime.utcnow)
    updated_at = Column(
        TIMESTAMP, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        CheckConstraint(
            "type IN ('text','voice','broadcast')",
            name="ck_channel_type"),
    )

    owner = relationship("User", foreign_keys=[owner_id], backref="owned_channels")
    participants = relationship(
        "User",
        secondary=channel_participants,
        lazy="selectin",
        backref=backref("channels", lazy="selectin"),
    )
    community_channel = relationship(
        "CommunityChannel",
        primaryjoin="Channel.id == CommunityChannel.id",
        foreign_keys="CommunityChannel.id",
        uselist=False,
        backref=backref("channel_mirror", uselist=False),
        viewonly=True,
    )

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "avatar_url": self.avatar_url,
            "invite_code": self.invite_code,
            "owner_id": self.owner_id,
            "type": self.type,
            "community_id": self.community_channel.community_id if self.community_channel else None,
            "participants_count": len(self.participants or []),
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }

