import uuid
from datetime import datetime

from sqlalchemy import TEXT, TIMESTAMP

from app.core.extensions import db


class VideoComment(db.Model):
    __tablename__ = "video_comments"

    id = db.Column(TEXT, primary_key=True, default=lambda: str(uuid.uuid4()))
    video_id = db.Column(
        TEXT,
        db.ForeignKey("videos.id"),
        nullable=False,
        index=True)
    posted_by = db.Column(TEXT, db.ForeignKey("users.id"), nullable=False)
    content = db.Column(TEXT, nullable=False)
    created_at = db.Column(TIMESTAMP, default=datetime.utcnow)
