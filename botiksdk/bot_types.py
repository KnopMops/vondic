from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Dict, List, Optional


@dataclass
class User:
    id: str
    username: Optional[str] = None
    avatar_url: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    language_code: Optional[str] = None

    @classmethod
    def from_dict(cls, data: Dict[str, Any]):
        if data is None:
            return None
        return cls(
            id=str(data.get("id") or ""),
            username=data.get("username"),
            avatar_url=data.get("avatar_url"),
            first_name=data.get("first_name"),
            last_name=data.get("last_name"),
            language_code=data.get("language_code"),
        )


@dataclass
class Chat:
    id: str
    type: str = "private"
    title: Optional[str] = None
    username: Optional[str] = None

    @classmethod
    def from_dict(cls, data: Dict[str, Any]):
        if data is None:
            return None
        return cls(
            id=str(data.get("id") or ""),
            type=data.get("type") or "private",
            title=data.get("title"),
            username=data.get("username"),
        )


@dataclass
class PhotoSize:
    file_id: str
    file_unique_id: str
    width: int
    height: int
    file_size: Optional[int] = None

    @classmethod
    def from_dict(cls, data: Dict[str, Any]):
        if data is None:
            return None
        return cls(
            file_id=data.get("file_id", ""),
            file_unique_id=data.get("file_unique_id", ""),
            width=data.get("width", 0),
            height=data.get("height", 0),
            file_size=data.get("file_size"),
        )


@dataclass
class InlineKeyboardButton:
    text: str
    callback_data: Optional[str] = None
    url: Optional[str] = None

    @classmethod
    def from_dict(cls, data: Dict[str, Any]):
        if data is None:
            return None
        return cls(
            text=data.get("text", ""),
            callback_data=data.get("callback_data"),
            url=data.get("url"),
        )


@dataclass
class CallbackQuery:
    id: str
    from_user: Optional[User]
    message: Optional["Message"]
    data: str
    chat_instance: Optional[str] = None

    @classmethod
    def from_dict(cls, data: Dict[str, Any]):
        if data is None:
            return None
        return cls(
            id=str(data.get("id") or ""),
            from_user=User.from_dict(data.get("from")),
            message=Message.from_dict(data.get("message")) if data.get("message") else None,
            data=data.get("data", ""),
            chat_instance=data.get("chat_instance"),
        )


@dataclass
class Message:
    message_id: str
    text: Optional[str]
    from_user: Optional[User]
    chat: Optional[Chat]
    date: Optional[datetime]
    raw: Dict[str, Any]
    callback_query: Optional[CallbackQuery] = None
    photo: Optional[List[PhotoSize]] = None

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

        photo_data = data.get("photo")
        photo_list = None
        if photo_data and isinstance(photo_data, list):
            photo_list = [PhotoSize.from_dict(p) for p in photo_data]

        return cls(
            message_id=str(data.get("message_id") or data.get("id") or ""),
            text=data.get("text"),
            from_user=User.from_dict(data.get("from")),
            chat=Chat.from_dict(data.get("chat")),
            date=date_value,
            raw=data,
            callback_query=None,
            photo=photo_list,
        )


@dataclass
class Update:
    update_id: str
    message: Optional[Message]
    callback_query: Optional[CallbackQuery]
    raw: Dict[str, Any]

    @classmethod
    def from_dict(cls, data: Dict[str, Any]):
        if data is None:
            return None

        callback_data = data.get("callback_query")
        callback_query = None
        if callback_data:
            callback_query = CallbackQuery.from_dict(callback_data)

        message_data = data.get("message")
        message = None
        if message_data:
            message = Message.from_dict(message_data)
            if callback_query and not message.callback_query:
                message.callback_query = callback_query

        return cls(
            update_id=str(data.get("update_id") or data.get("id") or ""),
            message=message,
            callback_query=callback_query,
            raw=data,
        )


@dataclass
class InlineKeyboardRow:
    buttons: List[InlineKeyboardButton] = field(default_factory=list)

    def add(self, button: InlineKeyboardButton):
        self.buttons.append(button)


@dataclass
class InlineKeyboardMarkup:
    inline_keyboard: List[List[Dict[str, Any]]]
    resize_keyboard: Optional[bool] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "inline_keyboard": self.inline_keyboard,
            **(
                {"resize_keyboard": self.resize_keyboard}
                if self.resize_keyboard is not None
                else {}
            ),
        }
