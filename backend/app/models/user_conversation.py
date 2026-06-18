import uuid
from datetime import datetime

from sqlalchemy import TEXT, TIMESTAMP, UniqueConstraint

from app.core.extensions import db


class UserConversation(db.Model):
    __tablename__ = "user_conversations"

    id = db.Column(TEXT, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = db.Column(TEXT, db.ForeignKey("users.id"), nullable=False)
    partner_id = db.Column(TEXT, db.ForeignKey("users.id"), nullable=False)
    is_secret = db.Column(db.Boolean, default=False, nullable=False)
    created_at = db.Column(TIMESTAMP, default=datetime.utcnow)
    updated_at = db.Column(
        TIMESTAMP, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    __table_args__ = (
        UniqueConstraint("user_id", "partner_id", name="uq_user_conversation"),
    )

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "partner_id": self.partner_id,
            "is_secret": bool(
                self.is_secret),
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
