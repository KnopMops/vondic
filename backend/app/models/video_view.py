import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text
from app.core.database import Base


class VideoView(Base):
    __tablename__ = "video_views"

    id = Column(Text, primary_key=True, default=lambda: str(uuid.uuid4()))
    video_id = Column(Text, ForeignKey("videos.id"), nullable=False, index=True)
    user_id = Column(Text, ForeignKey("users.id"), nullable=True)
    ip = Column(Text, nullable=True, index=True)
    count = Column(Integer, default=1)
    created_at = Column(DateTime, default=datetime.utcnow)
