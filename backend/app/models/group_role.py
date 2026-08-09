from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint, func
from app.core.database import Base


class GroupRole(Base):
    __tablename__ = "group_roles"

    id = Column(Integer, primary_key=True, autoincrement=True)
    group_id = Column(Text, ForeignKey("groups.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Text, ForeignKey("users.id"), nullable=False)
    role = Column(Text, nullable=False, default="member")
    created_at = Column(DateTime, server_default=func.now())

    __table_args__ = (UniqueConstraint("group_id", "user_id", name="uq_group_role"),)
