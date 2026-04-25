import uuid
from datetime import datetime

from sqlalchemy import INTEGER, TEXT, TIMESTAMP

from app.core.extensions import db


class VideoView(db.Model):
    __tablename__ = "video_views"

    id = db.Column(TEXT, primary_key=True, default=lambda: str(uuid.uuid4()))
    video_id = db.Column(
        TEXT,
        db.ForeignKey("videos.id"),
        nullable=False,
        index=True)
    user_id = db.Column(TEXT, db.ForeignKey("users.id"), nullable=True)
    ip = db.Column(TEXT, nullable=True, index=True)
    count = db.Column(INTEGER, default=1)
    created_at = db.Column(TIMESTAMP, default=datetime.utcnow)
