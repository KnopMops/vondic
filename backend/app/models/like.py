import uuid
from datetime import datetime

from sqlalchemy.dialects.sqlite import TEXT, TIMESTAMP

from app.core.extensions import db


class Like(db.Model):
    __tablename__ = "likes"
    id = db.Column(TEXT, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = db.Column(TEXT, db.ForeignKey("users.id"), nullable=False)
    post_id = db.Column(TEXT, db.ForeignKey("posts.id"), nullable=True)
    comment_id = db.Column(TEXT, db.ForeignKey("comments.id"), nullable=True)
    created_at = db.Column(TIMESTAMP, default=datetime.utcnow)

    __table_args__ = (
        db.CheckConstraint(
            '(post_id IS NOT NULL AND comment_id IS NULL) OR (post_id IS NULL AND comment_id IS NOT NULL)',
            name='check_post_xor_comment'
        ),
        db.UniqueConstraint('user_id', 'post_id', name='uq_user_post_like'),
        db.UniqueConstraint('user_id', 'comment_id',
                            name='uq_user_comment_like'),
    )

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "post_id": self.post_id,
            "comment_id": self.comment_id,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
