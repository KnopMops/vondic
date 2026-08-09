import uuid
from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, String, Text
from app.core.database import Base


class PlaylistBorrow(Base):
    __tablename__ = "playlist_borrows"

    id = Column(Text, primary_key=True, default=lambda: str(uuid.uuid4()))
    borrower_id = Column(Text, ForeignKey("users.id"), nullable=False)
    local_playlist_id = Column(Text, ForeignKey("playlists.id"), nullable=False)
    source_playlist_id = Column(Text, ForeignKey("playlists.id"), nullable=False)
    source_owner_id = Column(Text, ForeignKey("users.id"), nullable=False)
    status = Column(Text, default="pending")
    auto_sync = Column(Boolean, default=False)
    last_synced_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
