import uuid
from datetime import datetime

from sqlalchemy import Column, String, DateTime, Boolean, Text
from app.core.database import Base


class CorporateInstance(Base):
    __tablename__ = "corporate_instances"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    instance_uuid = Column(String, unique=True, nullable=False, index=True)
    secret_key_hash = Column(String, nullable=False)
    api_key = Column(String, unique=True, nullable=False, index=True)
    domain = Column(String, nullable=True)
    company_name = Column(String, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    last_seen_at = Column(DateTime, default=datetime.utcnow)
    metadata_json = Column(Text, nullable=True)
