import uuid
from datetime import datetime

from sqlalchemy import TEXT, TIMESTAMP

from app.core.extensions import db


class VideoCheck(db.Model):
    __tablename__ = "video_checks"

    id = db.Column(TEXT, primary_key=True, default=lambda: str(uuid.uuid4()))
    video_url = db.Column(TEXT, nullable=False)
    file_path = db.Column(TEXT, nullable=False)
    status = db.Column(TEXT, default="queued")
    result = db.Column(TEXT, nullable=True)
    error = db.Column(TEXT, nullable=True)
    created_at = db.Column(TIMESTAMP, default=datetime.utcnow)
    updated_at = db.Column(
        TIMESTAMP,
        default=datetime.utcnow,
        onupdate=datetime.utcnow)
