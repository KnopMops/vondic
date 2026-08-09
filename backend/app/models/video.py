import uuid
from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text
from app.core.database import Base


class Video(Base):
    __tablename__ = "videos"

    id = Column(Text, primary_key=True, default=lambda: str(uuid.uuid4()))
    author_id = Column(Text, ForeignKey("users.id"), nullable=False)
    title = Column(Text, nullable=False)
    description = Column(Text, nullable=True)
    url = Column(Text, nullable=False)
    poster = Column(Text, nullable=True)
    duration = Column(Integer, nullable=True)
    tags = Column(Text, nullable=True)
    views = Column(Integer, default=0)
    likes = Column(Integer, default=0)
    is_deleted = Column(Boolean, default=False)
    allow_comments = Column(Boolean, default=True)
    is_nsfw = Column(Boolean, default=False)
    has_profanity = Column(Boolean, default=False)
    is_published = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
