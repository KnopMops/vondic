import uuid
from datetime import datetime

from sqlalchemy import Column, TEXT, TIMESTAMP, BigInteger

from app.core.database import Base


class UserFile(Base):
    __tablename__ = "user_files"

    id = Column(TEXT, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(TEXT, nullable=False, index=True)
    name = Column(TEXT, nullable=False)
    url = Column(TEXT, nullable=False)
    size = Column(BigInteger, nullable=False, default=0)
    created_at = Column(TIMESTAMP, default=datetime.utcnow, nullable=False)

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "url": self.url,
            "size": int(
                self.size or 0),
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
