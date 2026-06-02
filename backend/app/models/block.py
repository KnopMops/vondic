import uuid
from datetime import datetime

from sqlalchemy import TEXT, TIMESTAMP

from app.core.extensions import db


class Block(db.Model):
    __tablename__ = "blocks"
    id = db.Column(TEXT, primary_key=True, default=lambda: str(uuid.uuid4()))
    blocker_id = db.Column(TEXT, db.ForeignKey("users.id"), nullable=False)
    blocked_id = db.Column(TEXT, db.ForeignKey("users.id"), nullable=False)
    created_at = db.Column(TIMESTAMP, default=datetime.utcnow)

    __table_args__ = (
        db.UniqueConstraint("blocker_id", "blocked_id", name="uq_block"),
    )

    blocker = db.relationship(
        "User", foreign_keys=[blocker_id], backref="blocks_made"
    )
    blocked = db.relationship(
        "User", foreign_keys=[blocked_id], backref="blocks_received"
    )
