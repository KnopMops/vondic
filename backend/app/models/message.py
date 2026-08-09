import uuid
from datetime import datetime

from sqlalchemy import Column, ForeignKey, Boolean, Integer, JSON, TEXT, TIMESTAMP
from sqlalchemy.orm import relationship, backref

from app.core.database import Base


class Message(Base):
    __tablename__ = "messages"

    id = Column(TEXT, primary_key=True, default=lambda: str(uuid.uuid4()))
    content = Column(TEXT, nullable=False)
    attachments = Column(JSON, nullable=True)
    type = Column(TEXT, default="text", nullable=False)
    sender_id = Column(TEXT, ForeignKey("users.id"), nullable=False)
    target_id = Column(TEXT, ForeignKey("users.id"), nullable=True)
    group_id = Column(TEXT, ForeignKey("groups.id"), nullable=True)
    channel_id = Column(TEXT, ForeignKey("channels.id"), nullable=True)

    is_deleted = Column(Boolean, default=False)
    is_edited = Column(Boolean, default=False)
    edit_history = Column(JSON, nullable=True)

    pinned_by = Column(TEXT, nullable=True)

    reactions = Column(JSON, nullable=True)
    read_by = Column(JSON, nullable=True)
    reply_to_id = Column(TEXT, nullable=True)
    forwarded_from_id = Column(TEXT, nullable=True)
    thread_id = Column(TEXT, nullable=True)
    disappear_after = Column(Integer, nullable=True)
    disappear_at = Column(TIMESTAMP, nullable=True)

    created_at = Column(TIMESTAMP, default=datetime.utcnow)
    updated_at = Column(
        TIMESTAMP, default=datetime.utcnow, onupdate=datetime.utcnow)

    sender = relationship(
        "User",
        foreign_keys=[sender_id],
        backref=backref(
            "sent_messages",
            lazy="selectin"))
    target = relationship(
        "User",
        foreign_keys=[target_id],
        backref=backref("received_messages", lazy="selectin"),
    )
    group = relationship(
        "Group",
        backref=backref(
            "messages",
            lazy="selectin",
            cascade="all, delete-orphan"))

    def to_dict(self):
        return {
            "id": self.id,
            "content": self.content if not getattr(
                self,
                'is_deleted',
                False) else "Сообщение удалено",
            "attachments": self.attachments if not getattr(
                self,
                'is_deleted',
                False) else [],
            "sender_id": self.sender_id,
            "sender_username": self.sender.username if self.sender else None,
            "sender_avatar": self.sender.avatar_url if self.sender else None,
            "target_id": self.target_id,
            "group_id": self.group_id,
            "channel_id": self.channel_id,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "is_edited": getattr(
                self,
                'is_edited',
                False),
            "pinned_by": self.pinned_by,
            "reactions": self.reactions or [],
            "read_by": self.read_by or [],
            "reply_to_id": self.reply_to_id,
            "forwarded_from_id": self.forwarded_from_id,
            "is_deleted": getattr(
                    self,
                    'is_deleted',
                    False),
        }

