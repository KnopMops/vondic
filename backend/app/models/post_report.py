from datetime import datetime

from sqlalchemy import Column, DateTime, Integer, String, Text
from app.core.database import Base


class PostReport(Base):
    __tablename__ = "post_reports"

    id = Column(Integer, primary_key=True, autoincrement=True)
    reporter_id = Column(Text, nullable=False)
    reporter_login = Column(Text, nullable=True)
    post_id = Column(Text, nullable=False)
    post_author_login = Column(Text, nullable=True)
    description = Column(Text, nullable=True)
    attachments = Column(Text, nullable=True)
    reason = Column(Text, nullable=True)
    status = Column(Text, default="open")
    created_at = Column(DateTime, default=datetime.utcnow)
    verdict_at = Column(Integer, nullable=True)
