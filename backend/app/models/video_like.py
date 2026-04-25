import uuid
from datetime import datetime

from sqlalchemy import TEXT, TIMESTAMP, UniqueConstraint

from app.core.extensions import db


class VideoLike(db.Model):
    __tablename__ = "video_likes"
    __table_args__ = (
        UniqueConstraint(
            "video_id",
            "user_id",
            name="uq_video_likes_vid_uid"),
    )

    id = db.Column(TEXT, primary_key=True, default=lambda: str(uuid.uuid4()))
    video_id = db.Column(
        TEXT,
        db.ForeignKey("videos.id"),
        nullable=False,
        index=True)
    user_id = db.Column(TEXT, db.ForeignKey("users.id"), nullable=False)
    created_at = db.Column(TIMESTAMP, default=datetime.utcnow)
