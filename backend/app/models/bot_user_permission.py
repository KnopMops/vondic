"""Bot user permissions model — stores consent grants from users to bots."""
from app.core.extensions import db


class BotUserPermission(db.Model):
    __tablename__ = "bot_user_permissions"

    id = db.Column(db.Text, primary_key=True)
    bot_id = db.Column(db.Text, db.ForeignKey("bots.id"), nullable=False, index=True)
    user_id = db.Column(db.Text, db.ForeignKey("users.id"), nullable=False, index=True)
    scopes = db.Column(db.Text, nullable=False, default="basic_profile,send_messages")
    granted_at = db.Column(db.DateTime, server_default=db.func.now())

    __table_args__ = (
        db.UniqueConstraint("bot_id", "user_id", name="uq_bot_user_permission"),
    )
