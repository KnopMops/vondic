from sqlalchemy import TEXT, INTEGER, TIMESTAMP, JSON, BOOLEAN
from sqlalchemy.sql import func
from app.core.extensions import db


class StickerPack(db.Model):
    __tablename__ = "sticker_packs"
    id = db.Column(TEXT, primary_key=True)
    name = db.Column(TEXT, nullable=False)
    creator_id = db.Column(TEXT, db.ForeignKey("users.id"), nullable=True)
    is_official = db.Column(BOOLEAN, default=False)
    icon_url = db.Column(TEXT, nullable=True)
    created_at = db.Column(TIMESTAMP, server_default=func.now())
    stickers = db.relationship("Sticker", backref="pack", cascade="all, delete-orphan", order_by="Sticker.position")

    def to_dict(self):
        return {
            "id": self.id, "name": self.name, "is_official": self.is_official,
            "icon_url": self.icon_url,
            "stickers": [s.to_dict() for s in self.stickers],
        }


class Sticker(db.Model):
    __tablename__ = "stickers"
    id = db.Column(TEXT, primary_key=True)
    pack_id = db.Column(TEXT, db.ForeignKey("sticker_packs.id", ondelete="CASCADE"), nullable=False)
    image_url = db.Column(TEXT, nullable=False)
    emoji = db.Column(TEXT, nullable=True)
    position = db.Column(INTEGER, default=0)

    def to_dict(self):
        return {"id": self.id, "image_url": self.image_url, "emoji": self.emoji, "position": self.position}


class UserCustomSticker(db.Model):
    __tablename__ = "user_custom_stickers"
    id = db.Column(TEXT, primary_key=True)
    user_id = db.Column(TEXT, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    url = db.Column(TEXT, nullable=False)
    name = db.Column(TEXT, nullable=True)
    type = db.Column(TEXT, nullable=False, default="sticker")  # "sticker" или "gif"
    created_at = db.Column(TIMESTAMP, server_default=func.now())

    def to_dict(self):
        return {
            "id": self.id,
            "url": self.url,
            "name": self.name or ("Стикер" if self.type == "sticker" else "GIF"),
            "type": self.type,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
