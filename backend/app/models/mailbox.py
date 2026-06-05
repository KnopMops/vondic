import uuid
from datetime import datetime

from app.core.extensions import db


class Mailbox(db.Model):
    """Почтовый ящик @vondic.ru, привязанный к пользователю Vondic."""

    __tablename__ = "mailboxes"

    id = db.Column(
        db.TEXT,
        primary_key=True,
        default=lambda: str(
            uuid.uuid4()))
    user_id = db.Column(
        db.TEXT,
        db.ForeignKey("users.id"),
        unique=True,
        nullable=False)
    address = db.Column(db.TEXT, unique=True, nullable=False)
    display_name = db.Column(db.TEXT, nullable=True)
    quota_mb = db.Column(db.Integer, default=1024)
    is_active = db.Column(db.Integer, default=1)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(
        db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    credential = db.relationship(
        "MailboxCredential",
        back_populates="mailbox",
        uselist=False,
        cascade="all, delete-orphan",
    )


class MailboxCredential(db.Model):
    """Пароль ящика (шифрование Fernet), только для backend ↔ Dovecot/SMTP."""

    __tablename__ = "mailbox_credentials"

    id = db.Column(
        db.TEXT,
        primary_key=True,
        default=lambda: str(
            uuid.uuid4()))
    mailbox_id = db.Column(
        db.TEXT, db.ForeignKey("mailboxes.id"), unique=True, nullable=False
    )
    password_encrypted = db.Column(db.TEXT, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    mailbox = db.relationship("Mailbox", back_populates="credential")
