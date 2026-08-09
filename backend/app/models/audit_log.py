from sqlalchemy import Column, Integer, JSON, String, Text, DateTime
from sqlalchemy.sql import func
from app.core.database import Base


class AuditLog(Base):
    __tablename__ = "audit_log"

    id = Column(Integer, primary_key=True, autoincrement=True)
    group_id = Column(Text, nullable=True, index=True)
    channel_id = Column(Text, nullable=True, index=True)
    user_id = Column(Text, nullable=False)
    action = Column(Text, nullable=False)
    target_user_id = Column(Text, nullable=True)
    details = Column(JSON, nullable=True)
    created_at = Column(DateTime, server_default=func.now())

    def to_dict(self):
        return {
            "id": self.id,
            "group_id": self.group_id,
            "channel_id": self.channel_id,
            "user_id": self.user_id,
            "action": self.action,
            "target_user_id": self.target_user_id,
            "details": self.details,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
