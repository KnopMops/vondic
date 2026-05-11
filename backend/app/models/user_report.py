from datetime import datetime

from sqlalchemy import INTEGER, TEXT, TIMESTAMP

from app.core.extensions import db


class UserReport(db.Model):
    __tablename__ = "user_reports"

    id = db.Column(INTEGER, primary_key=True, autoincrement=True)
    reporter_id = db.Column(TEXT, nullable=False)
    reporter_login = db.Column(TEXT, nullable=True)
    target_user_id = db.Column(TEXT, nullable=False)
    target_user_login = db.Column(TEXT, nullable=True)
    description = db.Column(TEXT, nullable=True)
    attachments = db.Column(TEXT, nullable=True)  # JSON list
    status = db.Column(TEXT, default="pending")
    created_at = db.Column(TIMESTAMP, default=datetime.utcnow)
    verdict_at = db.Column(INTEGER, nullable=True)

