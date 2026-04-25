from datetime import datetime

from sqlalchemy import INTEGER, TEXT, TIMESTAMP

from app.core.extensions import db


class Escalation(db.Model):
    __tablename__ = "escalations"

    id = db.Column(INTEGER, primary_key=True, autoincrement=True)
    user_id = db.Column(TEXT, nullable=False)
    question = db.Column(TEXT, nullable=False)
    status = db.Column(TEXT, default="open")
    created_at = db.Column(TIMESTAMP, default=datetime.utcnow)
    answered_at = db.Column(TIMESTAMP, nullable=True)
