import uuid
from datetime import datetime

from sqlalchemy import BOOLEAN, TEXT, TIMESTAMP, ForeignKey

from app.core.extensions import db


class PlaylistBorrow(db.Model):
    __tablename__ = "playlist_borrows"

    id = db.Column(TEXT, primary_key=True, default=lambda: str(uuid.uuid4()))
    borrower_id = db.Column(TEXT, ForeignKey("users.id"), nullable=False)
    local_playlist_id = db.Column(
        TEXT, ForeignKey("playlists.id"), nullable=False)
    source_playlist_id = db.Column(
        TEXT, ForeignKey("playlists.id"), nullable=False)
    source_owner_id = db.Column(TEXT, ForeignKey("users.id"), nullable=False)
    status = db.Column(TEXT, default="pending")
    auto_sync = db.Column(BOOLEAN, default=False)
    last_synced_at = db.Column(TIMESTAMP, nullable=True)
    created_at = db.Column(TIMESTAMP, default=datetime.utcnow)
