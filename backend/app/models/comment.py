import uuid
from datetime import datetime

from sqlalchemy import BOOLEAN, INTEGER, TEXT, TIMESTAMP

from app.core.extensions import db

class Comment(db.Model):
    __tablename__ = "comments"
    id = db.Column(TEXT, primary_key=True, default=lambda: str(uuid.uuid4()))
    content = db.Column(TEXT, nullable=False)
    posted_by = db.Column(TEXT, db.ForeignKey("users.id"), nullable=False)
    post_id = db.Column(TEXT, db.ForeignKey("posts.id"), nullable=False)
    parent_id = db.Column(TEXT, db.ForeignKey("comments.id"), nullable=True)
    deleted = db.Column(BOOLEAN, default=False)
    deleted_by = db.Column(TEXT, nullable=True)
    reason_for_deletion = db.Column(TEXT, nullable=True)
    deleted_at = db.Column(TIMESTAMP, nullable=True)
    created_at = db.Column(TIMESTAMP, default=datetime.utcnow)
    updated_at = db.Column(
        TIMESTAMP, default=datetime.utcnow, onupdate=datetime.utcnow)
    likes = db.Column(INTEGER, default=0)

    replies = db.relationship(
        "Comment", backref=db.backref("parent", remote_side=[id]), lazy=True
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
