from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import relationship
from app.core.database import Base


class ChatFolder(Base):
    __tablename__ = "chat_folders"

    id = Column(Text, primary_key=True)
    user_id = Column(Text, ForeignKey("users.id"), nullable=False, index=True)
    name = Column(Text, nullable=False)
    icon = Column(Text, nullable=True, default="📁")
    position = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime, server_default=func.now())

    items = relationship("ChatFolderItem", backref="folder", cascade="all, delete-orphan")

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


class ChatFolderItem(Base):
    __tablename__ = "chat_folder_items"

    id = Column(Integer, primary_key=True, autoincrement=True)
    folder_id = Column(Text, ForeignKey("chat_folders.id", ondelete="CASCADE"), nullable=False)
    chat_type = Column(Text, nullable=False)
    chat_id = Column(Text, nullable=False)
