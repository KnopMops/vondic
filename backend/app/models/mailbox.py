import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship
from app.core.database import Base


class Mailbox(Base):
    """Почтовый ящик @vondic.ru, привязанный к пользователю Vondic."""

    __tablename__ = "mailboxes"

    id = Column(Text, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(Text, ForeignKey("users.id"), unique=True, nullable=False)
    address = Column(Text, unique=True, nullable=False)
    display_name = Column(Text, nullable=True)
    quota_mb = Column(Integer, default=1024)
    is_active = Column(Integer, default=1)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    credential = relationship(
        "MailboxCredential",
        back_populates="mailbox",
        uselist=False,
        cascade="all, delete-orphan",
    )


class MailboxCredential(Base):
    """Пароль ящика (шифрование Fernet), только для backend ↔ Dovecot/SMTP."""

    __tablename__ = "mailbox_credentials"

    id = Column(Text, primary_key=True, default=lambda: str(uuid.uuid4()))
    mailbox_id = Column(Text, ForeignKey("mailboxes.id"), unique=True, nullable=False)
    password_encrypted = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    mailbox = relationship("Mailbox", back_populates="credential")
