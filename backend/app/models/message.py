import uuid
from datetime import datetime

from sqlalchemy.dialects.sqlite import JSON, TEXT, TIMESTAMP

from app.core.extensions import db


class Message(db.Model):
    __tablename__ = "messages"

    id = db.Column(TEXT, primary_key=True, default=lambda: str(uuid.uuid4()))
    content = db.Column(TEXT, nullable=False)
    attachments = db.Column(JSON, nullable=True)
    type = db.Column(TEXT, default="text", nullable=False)
    sender_id = db.Column(TEXT, db.ForeignKey("users.id"), nullable=False)
    target_id = db.Column(TEXT, db.ForeignKey("users.id"), nullable=True)
    group_id = db.Column(TEXT, db.ForeignKey("groups.id"), nullable=True)

    created_at = db.Column(TIMESTAMP, default=datetime.utcnow)
    updated_at = db.Column(
        TIMESTAMP, default=datetime.utcnow, onupdate=datetime.utcnow)

    sender = db.relationship("User", foreign_keys=[
                             sender_id], backref=db.backref("sent_messages", lazy=True))
    target = db.relationship("User", foreign_keys=[
                             target_id], backref=db.backref("received_messages", lazy=True))
    group = db.relationship("Group", backref=db.backref(
        "messages", lazy=True, cascade="all, delete-orphan"))

    def to_dict(self):
        return {
            "id": self.id,
            "content": self.content,
            "attachments": self.attachments,
            "sender_id": self.sender_id,
            "sender_username": self.sender.username if self.sender else None,
            "sender_avatar": self.sender.avatar_url if self.sender else None,
            "target_id": self.target_id,
            "group_id": self.group_id,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
