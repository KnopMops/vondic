"""Bot user permissions model — stores consent grants from users to bots."""
from sqlalchemy import Column, DateTime, ForeignKey, Text, UniqueConstraint, func
from app.core.database import Base


class BotUserPermission(Base):
    __tablename__ = "bot_user_permissions"

    id = Column(Text, primary_key=True)
    bot_id = Column(Text, ForeignKey("bots.id"), nullable=False, index=True)
    user_id = Column(Text, ForeignKey("users.id"), nullable=False, index=True)
    scopes = Column(Text, nullable=False, default="basic_profile,send_messages")
    granted_at = Column(DateTime, server_default=func.now())

    __table_args__ = (
        UniqueConstraint("bot_id", "user_id", name="uq_bot_user_permission"),
    )
