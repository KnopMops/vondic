import uuid
from datetime import datetime

from sqlalchemy import INTEGER, TEXT, TIMESTAMP

from app.core.extensions import db


class Bot(db.Model):
    __tablename__ = "bots"

    id = db.Column(TEXT, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = db.Column(TEXT, unique=True, nullable=False)
    description = db.Column(TEXT, default=None)
    avatar_url = db.Column(TEXT, default=None)
    is_active = db.Column(INTEGER, default=1)
    is_verified = db.Column(INTEGER, default=0)
    bot_token_hash = db.Column(TEXT, default=None)
    created_at = db.Column(TIMESTAMP, default=datetime.utcnow)
    updated_at = db.Column(
        TIMESTAMP, default=datetime.utcnow, onupdate=datetime.utcnow)
