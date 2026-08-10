import uuid
from datetime import datetime

from sqlalchemy import Column, ForeignKey, BOOLEAN, INTEGER, JSON, TEXT, TIMESTAMP
from sqlalchemy.orm import relationship

from app.core.database import Base


class Post(Base):
    __tablename__ = "posts"
    id = Column(TEXT, primary_key=True, default=lambda: str(uuid.uuid4()))
    content = Column(TEXT, nullable=True)
    attachments = Column(JSON, nullable=True)
    likes = Column(INTEGER, default=0)
    created_at = Column(TIMESTAMP, default=datetime.utcnow)
    deleted_at = Column(TIMESTAMP, nullable=True)
    deleted_by = Column(TEXT, nullable=True)
    reason_for_deletion = Column(TEXT, nullable=True)
    deleted = Column(BOOLEAN, default=False)
    updated_at = Column(
        TIMESTAMP, default=datetime.utcnow, onupdate=datetime.utcnow)
    reports = Column(INTEGER, default=0)
    posted_by = Column(TEXT, ForeignKey("users.id"), nullable=False)
    social_community_id = Column(
        TEXT, ForeignKey("social_communities.id"), nullable=True
    )
    is_blog = Column(BOOLEAN, default=False)

    comments = relationship("Comment", backref="post", lazy="selectin")

    def to_dict(self, viewer_id=None, **kwargs):
        data = {
            "id": self.id,
            "content": self.content,
            "attachments": self.attachments,
            "likes": self.likes,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "posted_by": self.posted_by,
            "social_community_id": self.social_community_id,
            "deleted": self.deleted,
            "is_blog": self.is_blog,
            "comments_count": len([c for c in (self.comments or []) if not getattr(c, "deleted", False)])
            if self.comments
            else 0,
        }
        if viewer_id:
            data["is_owner"] = (self.posted_by == str(viewer_id))
        return data
