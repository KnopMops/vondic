import uuid
from datetime import datetime

from sqlalchemy import TEXT, TIMESTAMP

from app.core.extensions import db

community_members = db.Table(
    "community_members",
    db.Column("user_id", TEXT, db.ForeignKey("users.id"), primary_key=True),
    db.Column("community_id", TEXT, db.ForeignKey(
        "communities.id"), primary_key=True),
    db.Column("joined_at", TIMESTAMP, default=datetime.utcnow),
)

class Community(db.Model):
    __tablename__ = "communities"

    id = db.Column(TEXT, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = db.Column(TEXT, nullable=False)
    description = db.Column(TEXT, nullable=True)
    invite_code = db.Column(
        TEXT, unique=True, default=lambda: str(uuid.uuid4())[:8])
    owner_id = db.Column(TEXT, db.ForeignKey("users.id"), nullable=False)

    created_at = db.Column(TIMESTAMP, default=datetime.utcnow)
    updated_at = db.Column(
        TIMESTAMP, default=datetime.utcnow, onupdate=datetime.utcnow)

    owner = db.relationship(
        "User", foreign_keys=[owner_id], backref="owned_communities"
    )
    members = db.relationship(
        "User",
        secondary=community_members,
        lazy="subquery",
        backref=db.backref("communities", lazy=True),
    )

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "invite_code": self.invite_code,
            "owner_id": self.owner_id,
            "members_count": len(
                self.members),
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
