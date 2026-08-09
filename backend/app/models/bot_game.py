import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text
from app.core.database import Base


class BotGame(Base):
    __tablename__ = "bot_games"

    id = Column(Text, primary_key=True, default=lambda: str(uuid.uuid4()))
    bot_id = Column(Text, ForeignKey("bots.id"), nullable=False, index=True)
    created_by = Column(Text, nullable=False, index=True)
    title = Column(Text, nullable=False)
    description = Column(Text, default=None)
    entry_path = Column(Text, default="index.html")
    storage_dir = Column(Text, nullable=False)
    scan_status = Column(Text, default="pending", index=True)
    scan_error = Column(Text, default=None)
    scan_result = Column(Text, default=None)
    is_published = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
