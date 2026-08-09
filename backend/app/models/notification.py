from datetime import datetime

from sqlalchemy import Column, DateTime, Integer, String, Text
from app.core.database import Base


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Text, nullable=False)
    title = Column(Text, nullable=True)
    type = Column(Text, default="system")
    message = Column(Text, nullable=False)
    notification_hash = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    is_read = Column("read", Integer, default=0)
