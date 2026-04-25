import uuid
from datetime import datetime

from sqlalchemy import TEXT, TIMESTAMP, BigInteger

from app.core.extensions import db


class UserFile(db.Model):
    __tablename__ = "user_files"

    id = db.Column(TEXT, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = db.Column(TEXT, nullable=False, index=True)
    name = db.Column(TEXT, nullable=False)
    url = db.Column(TEXT, nullable=False)
    size = db.Column(BigInteger, nullable=False, default=0)
    created_at = db.Column(TIMESTAMP, default=datetime.utcnow, nullable=False)

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "url": self.url,
            "size": int(
                self.size or 0),
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
