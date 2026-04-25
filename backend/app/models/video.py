import uuid
from datetime import datetime

from sqlalchemy import BOOLEAN, INTEGER, TEXT, TIMESTAMP

from app.core.extensions import db


class Video(db.Model):
    __tablename__ = "videos"

    id = db.Column(TEXT, primary_key=True, default=lambda: str(uuid.uuid4()))
    author_id = db.Column(TEXT, db.ForeignKey("users.id"), nullable=False)
    title = db.Column(TEXT, nullable=False)
    description = db.Column(TEXT, nullable=True)
    url = db.Column(TEXT, nullable=False)
    poster = db.Column(TEXT, nullable=True)
    duration = db.Column(INTEGER, nullable=True)
    tags = db.Column(TEXT, nullable=True)
    views = db.Column(INTEGER, default=0)
    likes = db.Column(INTEGER, default=0)
    is_deleted = db.Column(BOOLEAN, default=False)
    allow_comments = db.Column(BOOLEAN, default=True)
    is_nsfw = db.Column(BOOLEAN, default=False)
    has_profanity = db.Column(BOOLEAN, default=False)
    is_published = db.Column(BOOLEAN, default=True)
    created_at = db.Column(TIMESTAMP, default=datetime.utcnow)
    updated_at = db.Column(
        TIMESTAMP,
        default=datetime.utcnow,
        onupdate=datetime.utcnow)
