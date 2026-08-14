from sqlalchemy import Column, ForeignKey, TEXT, INTEGER, TIMESTAMP, JSON, BOOLEAN
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base


class StickerPack(Base):
    __tablename__ = "sticker_packs"
    id = Column(TEXT, primary_key=True)
    name = Column(TEXT, nullable=False)
    creator_id = Column(TEXT, ForeignKey("users.id"), nullable=True)
    is_official = Column(BOOLEAN, default=False)
    icon_url = Column(TEXT, nullable=True)
    created_at = Column(TIMESTAMP, server_default=func.now())
    stickers = relationship("Sticker", backref="pack", cascade="all, delete-orphan", order_by="Sticker.position")

    def to_dict(self):
        return {
            "id": self.id, "name": self.name, "is_official": self.is_official,
            "icon_url": self.icon_url,
            "stickers": [s.to_dict() for s in (self.stickers or [])],
        }


class Sticker(Base):
    __tablename__ = "stickers"
    id = Column(TEXT, primary_key=True)
    pack_id = Column(TEXT, ForeignKey("sticker_packs.id", ondelete="CASCADE"), nullable=False)
    image_url = Column(TEXT, nullable=False)
    emoji = Column(TEXT, nullable=True)
    position = Column(INTEGER, default=0)

    def to_dict(self):
        return {"id": self.id, "image_url": self.image_url, "emoji": self.emoji, "position": self.position}


class UserCustomSticker(Base):
    __tablename__ = "user_custom_stickers"
    id = Column(TEXT, primary_key=True)
    user_id = Column(TEXT, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    url = Column(TEXT, nullable=False)
    name = Column(TEXT, nullable=True)
    type = Column(TEXT, nullable=False, default="sticker")  # "sticker" или "gif"
    created_at = Column(TIMESTAMP, server_default=func.now())

    def to_dict(self):
        return {
            "id": self.id,
            "url": self.url,
            "name": self.name or ("Стикер" if self.type == "sticker" else "GIF"),
            "type": self.type,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
