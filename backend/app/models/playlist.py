import uuid
from datetime import datetime

from sqlalchemy import BOOLEAN, INTEGER, JSON, TEXT, TIMESTAMP, ForeignKey
from app.core.extensions import db


class Playlist(db.Model):
    __tablename__ = "playlists"
    id = db.Column(TEXT, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = db.Column(TEXT, nullable=False)
    description = db.Column(TEXT, nullable=True)
    cover_image = db.Column(TEXT, nullable=True)
    owner_id = db.Column(TEXT, ForeignKey("users.id"), nullable=False)
    is_public = db.Column(BOOLEAN, default=True)
    is_pinned = db.Column(BOOLEAN, default=False)
    tracks = db.Column(JSON, default=list)
    created_at = db.Column(TIMESTAMP, default=datetime.utcnow)
    updated_at = db.Column(
        TIMESTAMP, default=datetime.utcnow, onupdate=datetime.utcnow)

    owner = db.relationship("User", backref=db.backref("playlists", lazy=True))

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
