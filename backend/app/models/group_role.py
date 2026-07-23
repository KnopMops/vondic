from sqlalchemy import TEXT, INTEGER, TIMESTAMP, UniqueConstraint
from sqlalchemy.sql import func
from app.core.extensions import db


class GroupRole(db.Model):
    __tablename__ = "group_roles"

    id = db.Column(INTEGER, primary_key=True, autoincrement=True)
    group_id = db.Column(TEXT, db.ForeignKey("groups.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = db.Column(TEXT, db.ForeignKey("users.id"), nullable=False)
    role = db.Column(TEXT, nullable=False, default="member")
    created_at = db.Column(TIMESTAMP, server_default=func.now())

    __table_args__ = (UniqueConstraint("group_id", "user_id", name="uq_group_role"),)
