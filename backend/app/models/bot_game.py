import uuid
from datetime import datetime

from sqlalchemy import INTEGER, TEXT, TIMESTAMP

from app.core.extensions import db


class BotGame(db.Model):
    __tablename__ = "bot_games"

    id = db.Column(TEXT, primary_key=True, default=lambda: str(uuid.uuid4()))
    bot_id = db.Column(TEXT, db.ForeignKey("bots.id"), nullable=False, index=True)
    created_by = db.Column(TEXT, nullable=False, index=True)
    title = db.Column(TEXT, nullable=False)
    description = db.Column(TEXT, default=None)
    entry_path = db.Column(TEXT, default="index.html")
    storage_dir = db.Column(TEXT, nullable=False)
    scan_status = db.Column(TEXT, default="pending", index=True)
    scan_error = db.Column(TEXT, default=None)
    scan_result = db.Column(TEXT, default=None)
    is_published = db.Column(INTEGER, default=0)
    created_at = db.Column(TIMESTAMP, default=datetime.utcnow)
    updated_at = db.Column(
        TIMESTAMP, default=datetime.utcnow, onupdate=datetime.utcnow
    )
