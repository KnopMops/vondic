import uuid
from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import backref, relationship
from app.core.database import Base


class Comment(Base):
    __tablename__ = "comments"
    id = Column(Text, primary_key=True, default=lambda: str(uuid.uuid4()))
    content = Column(Text, nullable=False)
    posted_by = Column(Text, ForeignKey("users.id"), nullable=False)
    post_id = Column(Text, ForeignKey("posts.id"), nullable=False)
    parent_id = Column(Text, ForeignKey("comments.id"), nullable=True)
    deleted = Column(Boolean, default=False)
    deleted_by = Column(Text, nullable=True)
    reason_for_deletion = Column(Text, nullable=True)
    deleted_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    likes = Column(Integer, default=0)

    replies = relationship(
        "Comment", backref=backref("parent", remote_side=[id]), lazy=True
    )

    def to_dict(self):
        return {
            "id": self.id,
            "content": self.content,
            "posted_by": self.posted_by,
            "post_id": self.post_id,
            "parent_id": self.parent_id,
            "likes": self.likes,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "deleted": self.deleted,
        }
