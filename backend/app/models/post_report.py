from datetime import datetime

from sqlalchemy import INTEGER, TEXT, TIMESTAMP

from app.core.extensions import db


class PostReport(db.Model):
    __tablename__ = "post_reports"

    id = db.Column(INTEGER, primary_key=True, autoincrement=True)
    reporter_id = db.Column(TEXT, nullable=False)
    reporter_login = db.Column(TEXT, nullable=True)
    post_id = db.Column(TEXT, nullable=False)
    post_author_login = db.Column(TEXT, nullable=True)
    description = db.Column(TEXT, nullable=True)
    attachments = db.Column(TEXT, nullable=True)
    reason = db.Column(TEXT, nullable=True)
    status = db.Column(TEXT, default="open")
    created_at = db.Column(TIMESTAMP, default=datetime.utcnow)
    verdict_at = db.Column(INTEGER, nullable=True)
