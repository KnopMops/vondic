from sqlalchemy import TEXT, INTEGER, TIMESTAMP, JSON
from sqlalchemy.sql import func
from app.core.extensions import db


class AuditLog(db.Model):
    __tablename__ = "audit_log"

    id = db.Column(INTEGER, primary_key=True, autoincrement=True)
    group_id = db.Column(TEXT, nullable=True, index=True)
    channel_id = db.Column(TEXT, nullable=True, index=True)
    user_id = db.Column(TEXT, nullable=False)
    action = db.Column(TEXT, nullable=False)
    target_user_id = db.Column(TEXT, nullable=True)
    details = db.Column(JSON, nullable=True)
    created_at = db.Column(TIMESTAMP, server_default=func.now())

    def to_dict(self):
        return {
            "id": self.id, "group_id": self.group_id, "channel_id": self.channel_id,
            "user_id": self.user_id, "action": self.action,
            "target_user_id": self.target_user_id, "details": self.details,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
