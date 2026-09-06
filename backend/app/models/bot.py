import json
import uuid
from datetime import datetime

from sqlalchemy import Column, INTEGER, TEXT, TIMESTAMP

from app.core.database import Base

# Available scopes a bot can request
BOT_SCOPES = {
    "username": "Имя пользователя",
    "full_name": "Полное имя",
    "email": "Электронная почта",
    "avatar": "Аватар",
    "balance": "Баланс",
    "send_messages": "Отправка сообщений",
    "all": "Полный доступ ко всем данным",
}


class Bot(Base):
    __tablename__ = "bots"

    id = Column(TEXT, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(TEXT, unique=True, nullable=False)
    description = Column(TEXT, default=None)
    avatar_url = Column(TEXT, default=None)
    is_active = Column(INTEGER, default=1)
    is_verified = Column(INTEGER, default=0)
    bot_token_hash = Column(TEXT, default=None)
    owner_id = Column(TEXT, default=None, index=True)
    required_scopes = Column(TEXT, default="username,send_messages")
    created_at = Column(TIMESTAMP, default=datetime.utcnow)
    updated_at = Column(
        TIMESTAMP, default=datetime.utcnow, onupdate=datetime.utcnow)

    def get_scopes(self) -> list[str]:
        raw = self.required_scopes or "username,send_messages"
        return [s.strip() for s in raw.split(",") if s.strip()]

    def set_scopes(self, scopes: list[str]):
        self.required_scopes = ",".join(scopes)
