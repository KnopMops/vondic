import uuid
from datetime import datetime

from sqlalchemy.dialects.sqlite import TEXT, TIMESTAMP

from app.core.extensions import db


class Friendship(db.Model):
    __tablename__ = "friendships"
    id = db.Column(TEXT, primary_key=True, default=lambda: str(uuid.uuid4()))
    requester_id = db.Column(TEXT, db.ForeignKey("users.id"), nullable=False)
    addressee_id = db.Column(TEXT, db.ForeignKey("users.id"), nullable=False)
    status = db.Column(TEXT, default="pending")  # pending, accepted, rejected
    created_at = db.Column(TIMESTAMP, default=datetime.utcnow)
    updated_at = db.Column(
        TIMESTAMP, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Prevent duplicate requests between same users (regardless of direction is harder in SQLite check,
    # but we can enforce uniqueness on (requester, addressee) and handle logic in service)
    __table_args__ = (
        db.UniqueConstraint('requester_id', 'addressee_id',
                            name='uq_friendship_request'),
    )

    # Relationships
    requester = db.relationship(
        "User", foreign_keys=[requester_id], backref="sent_friend_requests")
    addressee = db.relationship(
        "User", foreign_keys=[addressee_id], backref="friendships")

    def to_dict(self):
        return {
            "id": self.id,
            "requester_id": self.requester_id,
            "addressee_id": self.addressee_id,
            "status": self.status,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
