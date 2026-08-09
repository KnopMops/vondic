from sqlalchemy import Column, DateTime, ForeignKey, Integer, JSON, String, Text, func
from app.core.database import Base


class ScheduledMessage(Base):
    __tablename__ = "scheduled_messages"

    id = Column(Text, primary_key=True)
    sender_id = Column(Text, ForeignKey("users.id"), nullable=False, index=True)
    target_user_id = Column(Text, nullable=True)
    channel_id = Column(Text, nullable=True)
    group_id = Column(Text, nullable=True)
    content = Column(Text, nullable=False)
    type = Column(Text, nullable=False, default="text")
    attachments = Column(JSON, nullable=True)
    scheduled_at = Column(DateTime, nullable=False)
    sent_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, server_default=func.now())

    def to_dict(self):
        return {
            "id": self.id,
            "sender_id": self.sender_id,
            "target_user_id": self.target_user_id,
            "channel_id": self.channel_id,
            "group_id": self.group_id,
            "content": self.content,
            "type": self.type,
            "attachments": self.attachments,
            "scheduled_at": self.scheduled_at.isoformat() if self.scheduled_at else None,
            "sent_at": self.sent_at.isoformat() if self.sent_at else None,
        }
