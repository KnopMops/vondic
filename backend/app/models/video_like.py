import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, String, Text, UniqueConstraint
from app.core.database import Base


class VideoLike(Base):
    __tablename__ = "video_likes"
    __table_args__ = (
        UniqueConstraint("video_id", "user_id", name="uq_video_likes_vid_uid"),
    )

    id = Column(Text, primary_key=True, default=lambda: str(uuid.uuid4()))
    video_id = Column(Text, ForeignKey("videos.id"), nullable=False, index=True)
    user_id = Column(Text, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
