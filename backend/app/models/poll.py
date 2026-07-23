from sqlalchemy import TEXT, TIMESTAMP, JSON, BOOLEAN, INTEGER
from sqlalchemy.sql import func
from app.core.extensions import db


class Poll(db.Model):
    __tablename__ = "polls"
    id = db.Column(TEXT, primary_key=True)
    message_id = db.Column(TEXT, nullable=True)
    question = db.Column(db.Text, nullable=False)
    options = db.Column(JSON, nullable=False)
    is_anonymous = db.Column(BOOLEAN, default=True)
    multiple_choice = db.Column(BOOLEAN, default=False)
    expires_at = db.Column(TIMESTAMP, nullable=True)
    created_at = db.Column(TIMESTAMP, server_default=func.now())
    votes = db.relationship("PollVote", backref="poll", cascade="all, delete-orphan")

    def to_dict(self):
        counts = {}
        voter_ids = {}
        for v in self.votes:
            counts[v.option_id] = counts.get(v.option_id, 0) + 1
            if not self.is_anonymous:
                voter_ids.setdefault(v.option_id, []).append(v.user_id)
        result = {
            "id": self.id, "question": self.question, "options": self.options,
            "is_anonymous": self.is_anonymous, "multiple_choice": self.multiple_choice,
            "expires_at": self.expires_at.isoformat() if self.expires_at else None,
            "votes": counts, "total_votes": len(self.votes),
        }
        if not self.is_anonymous:
            result["voter_ids"] = voter_ids
        return result


class PollVote(db.Model):
    __tablename__ = "poll_votes"
    id = db.Column(INTEGER, primary_key=True, autoincrement=True)
    poll_id = db.Column(TEXT, db.ForeignKey("polls.id", ondelete="CASCADE"), nullable=False)
    user_id = db.Column(TEXT, db.ForeignKey("users.id"), nullable=False)
    option_id = db.Column(TEXT, nullable=False)
    created_at = db.Column(TIMESTAMP, server_default=func.now())
