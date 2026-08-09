import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, String, Text
from app.core.database import Base


class VideoComment(Base):
    __tablename__ = "video_comments"

    id = Column(Text, primary_key=True, default=lambda: str(uuid.uuid4()))
    video_id = Column(Text, ForeignKey("videos.id"), nullable=False, index=True)
    posted_by = Column(Text, ForeignKey("users.id"), nullable=False)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
