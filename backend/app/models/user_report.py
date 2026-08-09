from datetime import datetime

from sqlalchemy import Column, DateTime, Integer, String, Text
from app.core.database import Base


class UserReport(Base):
    __tablename__ = "user_reports"

    id = Column(Integer, primary_key=True, autoincrement=True)
    reporter_id = Column(Text, nullable=False)
    reporter_login = Column(Text, nullable=True)
    target_user_id = Column(Text, nullable=False)
    target_user_login = Column(Text, nullable=True)
    description = Column(Text, nullable=True)
    attachments = Column(Text, nullable=True)
    status = Column(Text, default="pending")
    created_at = Column(DateTime, default=datetime.utcnow)
    verdict_at = Column(Integer, nullable=True)
