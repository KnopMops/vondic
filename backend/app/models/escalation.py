from datetime import datetime

from sqlalchemy import Column, DateTime, Integer, String, Text
from app.core.database import Base


class Escalation(Base):
    __tablename__ = "escalations"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Text, nullable=False)
    question = Column(Text, nullable=False)
    status = Column(Text, default="open")
    created_at = Column(DateTime, default=datetime.utcnow)
    answered_at = Column(DateTime, nullable=True)
