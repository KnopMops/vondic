from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text
from app.core.database import Base


class SupportChatMessage(Base):
    __tablename__ = "support_chat_messages"

    id = Column(Integer, primary_key=True, autoincrement=True)
    escalation_id = Column(Integer, ForeignKey("escalations.id"), nullable=False)
    sender = Column(Text, nullable=False)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    read = Column(Boolean, default=False)
