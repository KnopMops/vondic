import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, String, Text
from app.core.database import Base


class VideoCheck(Base):
    __tablename__ = "video_checks"

    id = Column(Text, primary_key=True, default=lambda: str(uuid.uuid4()))
    video_url = Column(Text, nullable=False)
    file_path = Column(Text, nullable=False)
    status = Column(Text, default="queued")
    result = Column(Text, nullable=True)
    error = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
