import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import relationship

from app.core.database import Base


class Block(Base):
    __tablename__ = "blocks"
    id = Column(Text, primary_key=True, default=lambda: str(uuid.uuid4()))
    blocker_id = Column(Text, ForeignKey("users.id"), nullable=False)
    blocked_id = Column(Text, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint("blocker_id", "blocked_id", name="uq_block"),
    )

    blocker = relationship(
        "User", foreign_keys=[blocker_id], backref="blocks_made"
    )
    blocked = relationship(
        "User", foreign_keys=[blocked_id], backref="blocks_received"
    )
