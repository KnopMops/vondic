import uuid
from datetime import datetime

from sqlalchemy import BOOLEAN, INTEGER, JSON, TEXT, TIMESTAMP

from app.core.extensions import db


class Post(db.Model):
    __tablename__ = "posts"
    id = db.Column(TEXT, primary_key=True, default=lambda: str(uuid.uuid4()))
    content = db.Column(TEXT, nullable=True)
    attachments = db.Column(JSON, nullable=True)
    likes = db.Column(INTEGER, default=0)
    created_at = db.Column(TIMESTAMP, default=datetime.utcnow)
    deleted_at = db.Column(TIMESTAMP, nullable=True)
    deleted_by = db.Column(TEXT, nullable=True)
    reason_for_deletion = db.Column(TEXT, nullable=True)
    deleted = db.Column(BOOLEAN, default=False)
    updated_at = db.Column(
        TIMESTAMP, default=datetime.utcnow, onupdate=datetime.utcnow)
    reports = db.Column(INTEGER, default=0)
    posted_by = db.Column(TEXT, db.ForeignKey("users.id"), nullable=False)
    is_blog = db.Column(BOOLEAN, default=False)

    comments = db.relationship("Comment", backref="post", lazy=True)

    def to_dict(self):
        return {
            "id": self.id,
            "content": self.content,
            "attachments": self.attachments,
            "likes": self.likes,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "posted_by": self.posted_by,
            "deleted": self.deleted,
            "is_blog": self.is_blog,
            "comments_count": len([c for c in self.comments if not c.deleted])
            if self.comments
            else 0,
        }
