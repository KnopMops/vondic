import uuid
from datetime import datetime

from sqlalchemy import Column, INTEGER, TEXT, TIMESTAMP

from app.core.database import Base


class Bot(Base):
    __tablename__ = "bots"

    id = Column(TEXT, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(TEXT, unique=True, nullable=False)
    description = Column(TEXT, default=None)
    avatar_url = Column(TEXT, default=None)
    is_active = Column(INTEGER, default=1)
    is_verified = Column(INTEGER, default=0)
    bot_token_hash = Column(TEXT, default=None)
    owner_id = Column(TEXT, default=None, index=True)
    created_at = Column(TIMESTAMP, default=datetime.utcnow)
    updated_at = Column(
        TIMESTAMP, default=datetime.utcnow, onupdate=datetime.utcnow)

