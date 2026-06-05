import uuid
from datetime import datetime

from sqlalchemy import BOOLEAN, TEXT, TIMESTAMP

from app.core.extensions import db

social_community_members = db.Table(
    "social_community_members",
    db.Column("user_id", TEXT, db.ForeignKey("users.id"), primary_key=True),
    db.Column(
        "social_community_id",
        TEXT,
        db.ForeignKey("social_communities.id"),
        primary_key=True,
    ),
    db.Column("role", TEXT, nullable=False, default="member"),
    db.Column("joined_at", TIMESTAMP, default=datetime.utcnow),
)


class SocialCommunity(db.Model):
    """Публичное сообщество (страница/группа как во VK), не сервер мессенджера."""

    __tablename__ = "social_communities"

    id = db.Column(TEXT, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = db.Column(TEXT, nullable=False)
    description = db.Column(TEXT, nullable=True)
    avatar_url = db.Column(TEXT, nullable=True)
    cover_url = db.Column(TEXT, nullable=True)
    invite_code = db.Column(
        TEXT, unique=True, default=lambda: str(uuid.uuid4())[:8]
    )
    is_public = db.Column(BOOLEAN, default=True)
    owner_id = db.Column(TEXT, db.ForeignKey("users.id"), nullable=False)
    created_at = db.Column(TIMESTAMP, default=datetime.utcnow)
    updated_at = db.Column(
        TIMESTAMP, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    owner = db.relationship(
        "User", foreign_keys=[owner_id], backref="owned_social_communities"
    )
    members = db.relationship(
        "User",
        secondary=social_community_members,
        lazy="subquery",
        backref=db.backref("social_communities", lazy=True),
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
            "members_count": len(self.members),
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
