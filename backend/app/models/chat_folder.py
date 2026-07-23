from sqlalchemy import TEXT, INTEGER, TIMESTAMP
from sqlalchemy.sql import func

from app.core.extensions import db


class ChatFolder(db.Model):
    __tablename__ = "chat_folders"

    id = db.Column(TEXT, primary_key=True)
    user_id = db.Column(TEXT, db.ForeignKey("users.id"), nullable=False, index=True)
    name = db.Column(TEXT, nullable=False)
    icon = db.Column(TEXT, nullable=True, default="📁")
    position = db.Column(INTEGER, nullable=False, default=0)
    created_at = db.Column(TIMESTAMP, server_default=func.now())

    items = db.relationship("ChatFolderItem", backref="folder", cascade="all, delete-orphan")

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "icon": self.icon,
            "position": self.position,
            "chats": [
                {"type": item.chat_type, "chat_id": item.chat_id}
                for item in sorted(self.items, key=lambda x: x.id or 0)
            ],
        }


class ChatFolderItem(db.Model):
    __tablename__ = "chat_folder_items"

    id = db.Column(INTEGER, primary_key=True, autoincrement=True)
    folder_id = db.Column(TEXT, db.ForeignKey("chat_folders.id", ondelete="CASCADE"), nullable=False)
    chat_type = db.Column(TEXT, nullable=False)
    chat_id = db.Column(TEXT, nullable=False)
