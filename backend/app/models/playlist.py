import uuid
from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.orm import backref, relationship
from app.core.database import Base


class Playlist(Base):
    __tablename__ = "playlists"
    id = Column(Text, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(Text, nullable=False)
    description = Column(Text, nullable=True)
    cover_image = Column(Text, nullable=True)
    owner_id = Column(Text, ForeignKey("users.id"), nullable=False)
    is_public = Column(Boolean, default=True)
    is_pinned = Column(Boolean, default=False)
    tracks = Column(JSON, default=list)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    owner = relationship("User", backref=backref("playlists", lazy=True))

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "cover_image": self.cover_image,
            "owner_id": self.owner_id,
            "is_public": bool(self.is_public),
            "is_pinned": bool(self.is_pinned),
            "tracks": self.tracks or [],
            "track_count": len(self.tracks or []),
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
