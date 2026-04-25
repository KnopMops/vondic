from datetime import datetime

from sqlalchemy import BOOLEAN, INTEGER, TEXT, TIMESTAMP, ForeignKey

from app.core.extensions import db


class SupportChatMessage(db.Model):
    __tablename__ = "support_chat_messages"

    id = db.Column(INTEGER, primary_key=True, autoincrement=True)
    escalation_id = db.Column(
        INTEGER,
        ForeignKey("escalations.id"),
        nullable=False)
    sender = db.Column(TEXT, nullable=False)
    content = db.Column(TEXT, nullable=False)
    created_at = db.Column(TIMESTAMP, default=datetime.utcnow)
    read = db.Column(BOOLEAN, default=False)
