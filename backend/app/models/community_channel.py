import uuid
from datetime import datetime

from sqlalchemy import CheckConstraint
from sqlalchemy import TEXT, TIMESTAMP

from app.core.extensions import db

class CommunityChannel(db.Model):
    __tablename__ = "community_channels"

    id = db.Column(TEXT, primary_key=True, default=lambda: str(uuid.uuid4()))
    community_id = db.Column(TEXT, db.ForeignKey(
        "communities.id"), nullable=False)
    name = db.Column(TEXT, nullable=False)
    description = db.Column(TEXT, nullable=True)
    type = db.Column(TEXT, nullable=False, default="text")

    created_at = db.Column(TIMESTAMP, default=datetime.utcnow)
    updated_at = db.Column(
        TIMESTAMP, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        db.UniqueConstraint("community_id", "name",
                            name="uq_community_channel_name"),
        CheckConstraint("type IN ('text','voice')", name="ck_channel_type"),
    )

    community = db.relationship(
        "Community",
        foreign_keys=[community_id],
        backref=db.backref("channels", lazy=True),
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
