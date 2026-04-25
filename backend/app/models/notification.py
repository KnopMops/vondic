from datetime import datetime

from sqlalchemy import INTEGER, TEXT, TIMESTAMP

from app.core.extensions import db


class Notification(db.Model):
    __tablename__ = "notifications"

    id = db.Column(INTEGER, primary_key=True, autoincrement=True)
    user_id = db.Column(TEXT, nullable=False)
    title = db.Column(TEXT, nullable=True)
    type = db.Column(TEXT, default="system")
    message = db.Column(TEXT, nullable=False)
    notification_hash = db.Column(TEXT, nullable=False)
    created_at = db.Column(TIMESTAMP, default=datetime.utcnow)

    is_read = db.Column("read", INTEGER, default=0)
