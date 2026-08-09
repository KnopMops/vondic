from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, JSON, String, Text, func
from sqlalchemy.orm import relationship
from app.core.database import Base


class Poll(Base):
    __tablename__ = "polls"
    id = Column(Text, primary_key=True)
    message_id = Column(Text, nullable=True)
    question = Column(Text, nullable=False)
    options = Column(JSON, nullable=False)
    is_anonymous = Column(Boolean, default=True)
    multiple_choice = Column(Boolean, default=False)
    expires_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    votes = relationship("PollVote", backref="poll", cascade="all, delete-orphan")

    def to_dict(self):
        counts = {}
        voter_ids = {}
        for v in (self.votes or []):
            counts[v.option_id] = counts.get(v.option_id, 0) + 1
            if not self.is_anonymous:
                voter_ids.setdefault(v.option_id, []).append(v.user_id)
        result = {
            "id": self.id,
            "question": self.question,
            "options": self.options,
            "is_anonymous": self.is_anonymous,
            "multiple_choice": self.multiple_choice,
            "expires_at": self.expires_at.isoformat() if self.expires_at else None,
            "votes": counts,
            "total_votes": len(self.votes or []),
        }
        if not self.is_anonymous:
            result["voter_ids"] = voter_ids
        return result


class PollVote(Base):
    __tablename__ = "poll_votes"
    id = Column(Integer, primary_key=True, autoincrement=True)
    poll_id = Column(Text, ForeignKey("polls.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Text, ForeignKey("users.id"), nullable=False)
    option_id = Column(Text, nullable=False)
    created_at = Column(DateTime, server_default=func.now())
