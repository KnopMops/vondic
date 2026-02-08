import uuid
from datetime import datetime

from app.core.extensions import db
from sqlalchemy.dialects.sqlite import TEXT, TIMESTAMP


class Subscription(db.Model):
    __tablename__ = "subscriptions"
    id = db.Column(TEXT, primary_key=True, default=lambda: str(uuid.uuid4()))
    subscriber_id = db.Column(TEXT, db.ForeignKey("users.id"), nullable=False)
    target_id = db.Column(TEXT, db.ForeignKey("users.id"), nullable=False)
    created_at = db.Column(TIMESTAMP, default=datetime.utcnow)

    __table_args__ = (
        db.UniqueConstraint('subscriber_id', 'target_id', name='uq_subscription'),
    )

    # Relationships
    subscriber = db.relationship(
        "User", foreign_keys=[subscriber_id], backref="following_subscriptions")
    target = db.relationship(
        "User", foreign_keys=[target_id], backref="follower_subscriptions")

    def to_dict(self):
        return {
            "id": self.id,
            "subscriber_id": self.subscriber_id,
            "target_id": self.target_id,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
