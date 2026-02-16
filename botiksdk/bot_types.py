from dataclasses import dataclass
from datetime import datetime
from typing import Any, Dict, Optional


@dataclass
class User:
    id: str
    username: Optional[str] = None
    avatar_url: Optional[str] = None

    @classmethod
    def from_dict(cls, data: Dict[str, Any]):
        if data is None:
            return None
        return cls(
            id=str(data.get("id") or ""),
            username=data.get("username"),
            avatar_url=data.get("avatar_url"),
        )


@dataclass
class Chat:
    id: str
    type: str = "private"
    title: Optional[str] = None

    @classmethod
    def from_dict(cls, data: Dict[str, Any]):
        if data is None:
            return None
        return cls(
            id=str(data.get("id") or ""),
            type=data.get("type") or "private",
            title=data.get("title"),
        )


@dataclass
class Message:
    message_id: str
    text: Optional[str]
    from_user: Optional[User]
    chat: Optional[Chat]
    date: Optional[datetime]
    raw: Dict[str, Any]

    @classmethod
    def from_dict(cls, data: Dict[str, Any]):
        if data is None:
            return None
        ts = data.get("date")
        if isinstance(ts, (int, float)):
            date_value = datetime.fromtimestamp(ts)
        elif isinstance(ts, str):
            try:
                date_value = datetime.fromisoformat(ts)
            except ValueError:
                date_value = None
        else:
            date_value = None
        return cls(
            message_id=str(data.get("message_id") or data.get("id") or ""),
            text=data.get("text"),
            from_user=User.from_dict(data.get("from_user")),
            chat=Chat.from_dict(data.get("chat")),
            date=date_value,
            raw=data,
        )


@dataclass
class Update:
    update_id: str
    message: Optional[Message]
    raw: Dict[str, Any]

    @classmethod
    def from_dict(cls, data: Dict[str, Any]):
        if data is None:
            return None
        return cls(
            update_id=str(data.get("update_id") or data.get("id") or ""),
            message=Message.from_dict(data.get("message")),
            raw=data,
        )
