from sqlalchemy import TEXT, TIMESTAMP, JSON
from sqlalchemy.sql import func
from app.core.extensions import db


class ScheduledMessage(db.Model):
    __tablename__ = "scheduled_messages"

    id = db.Column(TEXT, primary_key=True)
    sender_id = db.Column(TEXT, db.ForeignKey("users.id"), nullable=False, index=True)
    target_user_id = db.Column(TEXT, nullable=True)
    channel_id = db.Column(TEXT, nullable=True)
    group_id = db.Column(TEXT, nullable=True)
    content = db.Column(db.Text, nullable=False)
    type = db.Column(TEXT, nullable=False, default="text")
    attachments = db.Column(JSON, nullable=True)
    scheduled_at = db.Column(TIMESTAMP, nullable=False)
    sent_at = db.Column(TIMESTAMP, nullable=True)
    created_at = db.Column(TIMESTAMP, server_default=func.now())

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
