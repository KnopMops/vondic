"""BotikSDK v0.4.0 — All message and update types for full content parsing."""
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Dict, List, Optional, Union


@dataclass
class User:
    id: str
    username: Optional[str] = None
    avatar_url: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    language_code: Optional[str] = None
    is_bot: bool = False

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
            is_bot=bool(data.get("is_bot")),
        )


@dataclass
class Chat:
    id: str
    type: str = "private"
    title: Optional[str] = None
    username: Optional[str] = None
    description: Optional[str] = None

    @classmethod
    def from_dict(cls, data: Dict[str, Any]):
        if data is None:
            return None
        return cls(
            id=str(data.get("id") or ""),
            type=data.get("type") or "private",
            title=data.get("title"),
            username=data.get("username"),
            description=data.get("description"),
        )


@dataclass
class PhotoSize:
    file_id: str
    file_unique_id: str = ""
    width: int = 0
    height: int = 0
    file_size: Optional[int] = None
    file_url: Optional[str] = None

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
            file_url=data.get("file_url") or data.get("url"),
        )


@dataclass
class Video:
    file_id: str
    file_unique_id: str = ""
    width: int = 0
    height: int = 0
    duration: int = 0
    thumb: Optional[PhotoSize] = None
    file_size: Optional[int] = None
    file_url: Optional[str] = None

    @classmethod
    def from_dict(cls, data: Dict[str, Any]):
        if data is None:
            return None
        return cls(
            file_id=data.get("file_id", ""),
            file_unique_id=data.get("file_unique_id", ""),
            width=data.get("width", 0),
            height=data.get("height", 0),
            duration=data.get("duration", 0),
            thumb=PhotoSize.from_dict(data.get("thumb")),
            file_size=data.get("file_size"),
            file_url=data.get("file_url") or data.get("url"),
        )


@dataclass
class Document:
    file_id: str
    file_unique_id: str = ""
    file_name: Optional[str] = None
    mime_type: Optional[str] = None
    file_size: Optional[int] = None
    file_url: Optional[str] = None

    @classmethod
    def from_dict(cls, data: Dict[str, Any]):
        if data is None:
            return None
        return cls(
            file_id=data.get("file_id", ""),
            file_unique_id=data.get("file_unique_id", ""),
            file_name=data.get("file_name"),
            mime_type=data.get("mime_type"),
            file_size=data.get("file_size"),
            file_url=data.get("file_url") or data.get("url"),
        )


@dataclass
class Audio:
    file_id: str
    file_unique_id: str = ""
    duration: int = 0
    performer: Optional[str] = None
    title: Optional[str] = None
    mime_type: Optional[str] = None
    file_size: Optional[int] = None
    file_url: Optional[str] = None

    @classmethod
    def from_dict(cls, data: Dict[str, Any]):
        if data is None:
            return None
        return cls(
            file_id=data.get("file_id", ""),
            file_unique_id=data.get("file_unique_id", ""),
            duration=data.get("duration", 0),
            performer=data.get("performer"),
            title=data.get("title"),
            mime_type=data.get("mime_type"),
            file_size=data.get("file_size"),
            file_url=data.get("file_url") or data.get("url"),
        )


@dataclass
class Voice:
    file_id: str
    file_unique_id: str = ""
    duration: int = 0
    mime_type: Optional[str] = None
    file_size: Optional[int] = None
    file_url: Optional[str] = None

    @classmethod
    def from_dict(cls, data: Dict[str, Any]):
        if data is None:
            return None
        return cls(
            file_id=data.get("file_id", ""),
            file_unique_id=data.get("file_unique_id", ""),
            duration=data.get("duration", 0),
            mime_type=data.get("mime_type"),
            file_size=data.get("file_size"),
            file_url=data.get("file_url") or data.get("url"),
        )


@dataclass
class VideoNote:
    file_id: str
    file_unique_id: str = ""
    length: int = 0
    duration: int = 0
    thumb: Optional[PhotoSize] = None
    file_size: Optional[int] = None
    file_url: Optional[str] = None

    @classmethod
    def from_dict(cls, data: Dict[str, Any]):
        if data is None:
            return None
        return cls(
            file_id=data.get("file_id", ""),
            file_unique_id=data.get("file_unique_id", ""),
            length=data.get("length", 0),
            duration=data.get("duration", 0),
            thumb=PhotoSize.from_dict(data.get("thumb")),
            file_size=data.get("file_size"),
            file_url=data.get("file_url") or data.get("url"),
        )


@dataclass
class Sticker:
    file_id: str
    file_unique_id: str = ""
    type: str = "regular"
    width: int = 0
    height: int = 0
    is_animated: bool = False
    is_video: bool = False
    set_name: Optional[str] = None
    emoji: Optional[str] = None
    file_size: Optional[int] = None
    file_url: Optional[str] = None

    @classmethod
    def from_dict(cls, data: Dict[str, Any]):
        if data is None:
            return None
        return cls(
            file_id=data.get("file_id", ""),
            file_unique_id=data.get("file_unique_id", ""),
            type=data.get("type", "regular"),
            width=data.get("width", 0),
            height=data.get("height", 0),
            is_animated=bool(data.get("is_animated")),
            is_video=bool(data.get("is_video")),
            set_name=data.get("set_name"),
            emoji=data.get("emoji"),
            file_size=data.get("file_size"),
            file_url=data.get("file_url") or data.get("url"),
        )


@dataclass
class Location:
    latitude: float = 0.0
    longitude: float = 0.0

    @classmethod
    def from_dict(cls, data: Dict[str, Any]):
        if data is None:
            return None
        return cls(
            latitude=float(data.get("latitude", 0)),
            longitude=float(data.get("longitude", 0)),
        )


@dataclass
class Venue:
    location: Optional[Location] = None
    title: str = ""
    address: str = ""
    foursquare_id: Optional[str] = None
    foursquare_type: Optional[str] = None

    @classmethod
    def from_dict(cls, data: Dict[str, Any]):
        if data is None:
            return None
        loc = data.get("location") or {}
        return cls(
            location=Location.from_dict(loc) if loc else None,
            title=data.get("title", ""),
            address=data.get("address", ""),
            foursquare_id=data.get("foursquare_id"),
            foursquare_type=data.get("foursquare_type"),
        )


@dataclass
class Contact:
    phone_number: str = ""
    first_name: str = ""
    last_name: Optional[str] = None
    user_id: Optional[int] = None
    vcard: Optional[str] = None

    @classmethod
    def from_dict(cls, data: Dict[str, Any]):
        if data is None:
            return None
        return cls(
            phone_number=data.get("phone_number", ""),
            first_name=data.get("first_name", ""),
            last_name=data.get("last_name"),
            user_id=data.get("user_id"),
            vcard=data.get("vcard"),
        )


@dataclass
class PollOption:
    text: str = ""
    voter_count: int = 0

    @classmethod
    def from_dict(cls, data: Dict[str, Any]):
        if data is None:
            return None
        return cls(
            text=data.get("text", ""),
            voter_count=data.get("voter_count", 0),
        )


@dataclass
class Poll:
    id: str = ""
    question: str = ""
    options: List[PollOption] = field(default_factory=list)
    total_voter_count: int = 0
    is_closed: bool = False
    is_anonymous: bool = True
    allows_multiple_answers: bool = False
    type: str = "regular"

    @classmethod
    def from_dict(cls, data: Dict[str, Any]):
        if data is None:
            return None
        return cls(
            id=str(data.get("id", "")),
            question=data.get("question", ""),
            options=[PollOption.from_dict(o) for o in (data.get("options") or [])],
            total_voter_count=data.get("total_voter_count", 0),
            is_closed=bool(data.get("is_closed")),
            is_anonymous=bool(data.get("is_anonymous", True)),
            allows_multiple_answers=bool(data.get("allows_multiple_answers")),
            type=data.get("type", "regular"),
        )


@dataclass
class PollAnswer:
    poll_id: str = ""
    user: Optional[User] = None
    option_ids: List[int] = field(default_factory=list)

    @classmethod
    def from_dict(cls, data: Dict[str, Any]):
        if data is None:
            return None
        return cls(
            poll_id=str(data.get("poll_id", "")),
            user=User.from_dict(data.get("user")),
            option_ids=data.get("option_ids", []),
        )


@dataclass
class Dice:
    emoji: str = ""
    value: int = 0

    @classmethod
    def from_dict(cls, data: Dict[str, Any]):
        if data is None:
            return None
        return cls(
            emoji=data.get("emoji", ""),
            value=data.get("value", 0),
        )


@dataclass
class MessageEntity:
    type: str = ""
    offset: int = 0
    length: int = 0
    url: Optional[str] = None
    user: Optional[User] = None

    @classmethod
    def from_dict(cls, data: Dict[str, Any]):
        if data is None:
            return None
        return cls(
            type=data.get("type", ""),
            offset=data.get("offset", 0),
            length=data.get("length", 0),
            url=data.get("url"),
            user=User.from_dict(data.get("user")),
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
    from_user: Optional[User] = None
    message: Optional["Message"] = None
    data: str = ""
    chat_instance: Optional[str] = None
    game_short_name: Optional[str] = None

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
            game_short_name=data.get("game_short_name"),
        )


@dataclass
class Message:
    """Full message object — parses ALL content types from raw data.

    Every message type is accessible as a typed field AND as raw JSON dict.
    The `content_type` property returns the detected message type.
    """
    message_id: str
    text: Optional[str] = None
    from_user: Optional[User] = None
    chat: Optional[Chat] = None
    date: Optional[datetime] = None
    raw: Dict[str, Any] = field(default_factory=dict)

    # Content types — all Optional, only one is populated per message
    photo: Optional[List[PhotoSize]] = None
    video: Optional[Video] = None
    document: Optional[Document] = None
    audio: Optional[Audio] = None
    voice: Optional[Voice] = None
    video_note: Optional[VideoNote] = None
    sticker: Optional[Sticker] = None
    location: Optional[Location] = None
    venue: Optional[Venue] = None
    contact: Optional[Contact] = None
    poll: Optional[Poll] = None
    poll_answer: Optional[PollAnswer] = None
    dice: Optional[Dice] = None
    game_short_name: Optional[str] = None

    # Message metadata
    entities: Optional[List[MessageEntity]] = None
    caption: Optional[str] = None
    caption_entities: Optional[List[MessageEntity]] = None
    reply_to_message: Optional["Message"] = None
    forward_from: Optional[User] = None
    forward_from_chat: Optional[Chat] = None
    forward_date: Optional[int] = None

    # Linked objects
    callback_query: Optional[CallbackQuery] = None

    @property
    def content_type(self) -> str:
        """Return the detected content type of this message."""
        if self.poll:
            return "poll"
        if self.poll_answer:
            return "poll_answer"
        if self.photo:
            return "photo"
        if self.video:
            return "video"
        if self.document:
            return "document"
        if self.audio:
            return "audio"
        if self.voice:
            return "voice"
        if self.video_note:
            return "video_note"
        if self.sticker:
            return "sticker"
        if self.location:
            return "location"
        if self.venue:
            return "venue"
        if self.contact:
            return "contact"
        if self.dice:
            return "dice"
        if self.game_short_name:
            return "game"
        if self.text:
            return "text"
        return "unknown"

    @property
    def content(self) -> Any:
        """Return the primary content object based on content_type."""
        mapping = {
            "poll": self.poll,
            "poll_answer": self.poll_answer,
            "photo": self.photo,
            "video": self.video,
            "document": self.document,
            "audio": self.audio,
            "voice": self.voice,
            "video_note": self.video_note,
            "sticker": self.sticker,
            "location": self.location,
            "venue": self.venue,
            "contact": self.contact,
            "dice": self.dice,
            "game": self.game_short_name,
            "text": self.text,
        }
        return mapping.get(self.content_type)

    @property
    def file_url(self) -> Optional[str]:
        """Extract download URL from any media type. Returns S3 URL or file_id."""
        if self.photo:
            return getattr(self.photo[-1], "file_url", None) or self.photo[-1].file_id
        for media in [self.video, self.document, self.audio, self.voice, self.video_note, self.sticker]:
            if media and hasattr(media, "file_url"):
                return media.file_url
            if media and hasattr(media, "file_id"):
                return media.file_id
        return None

    @property
    def media_file_id(self) -> Optional[str]:
        """Get file_id of the primary media attachment."""
        if self.photo:
            return self.photo[-1].file_id
        for media in [self.video, self.document, self.audio, self.voice, self.video_note, self.sticker]:
            if media and hasattr(media, "file_id"):
                return media.file_id
        return None

    def to_dict(self) -> Dict[str, Any]:
        """Serialize entire message to a JSON-safe dict."""
        d: Dict[str, Any] = {
            "message_id": self.message_id,
            "content_type": self.content_type,
            "from_user": {
                "id": self.from_user.id,
                "username": self.from_user.username,
                "first_name": self.from_user.first_name,
                "last_name": self.from_user.last_name,
            } if self.from_user else None,
            "chat": {
                "id": self.chat.id,
                "type": self.chat.type,
                "title": self.chat.title,
            } if self.chat else None,
            "date": self.date.isoformat() if self.date else None,
        }
        # Add the specific content
        if self.text:
            d["text"] = self.text
        if self.photo:
            d["photo"] = [{"file_id": p.file_id, "width": p.width, "height": p.height} for p in self.photo]
        if self.video:
            d["video"] = {"file_id": self.video.file_id, "duration": self.video.duration}
        if self.document:
            d["document"] = {"file_id": self.document.file_id, "file_name": self.document.file_name, "mime_type": self.document.mime_type}
        if self.audio:
            d["audio"] = {"file_id": self.audio.file_id, "title": self.audio.title, "performer": self.audio.performer, "duration": self.audio.duration}
        if self.voice:
            d["voice"] = {"file_id": self.voice.file_id, "duration": self.voice.duration}
        if self.video_note:
            d["video_note"] = {"file_id": self.video_note.file_id, "duration": self.video_note.duration}
        if self.sticker:
            d["sticker"] = {"file_id": self.sticker.file_id, "emoji": self.sticker.emoji, "set_name": self.sticker.set_name}
        if self.location:
            d["location"] = {"latitude": self.location.latitude, "longitude": self.location.longitude}
        if self.venue:
            d["venue"] = {"title": self.venue.title, "address": self.venue.address}
        if self.contact:
            d["contact"] = {"phone_number": self.contact.phone_number, "first_name": self.contact.first_name, "user_id": self.contact.user_id}
        if self.poll:
            d["poll"] = {
                "id": self.poll.id, "question": self.poll.question,
                "options": [{"text": o.text, "voter_count": o.voter_count} for o in self.poll.options],
                "total_voter_count": self.poll.total_voter_count,
                "is_closed": self.poll.is_closed, "is_anonymous": self.poll.is_anonymous,
            }
        if self.poll_answer:
            d["poll_answer"] = {
                "poll_id": self.poll_answer.poll_id,
                "user": {"id": self.poll_answer.user.id} if self.poll_answer.user else None,
                "option_ids": self.poll_answer.option_ids,
            }
        if self.dice:
            d["dice"] = {"emoji": self.dice.emoji, "value": self.dice.value}
        if self.caption:
            d["caption"] = self.caption
        if self.entities:
            d["entities"] = [{"type": e.type, "offset": e.offset, "length": e.length, "url": e.url} for e in self.entities]
        if self.reply_to_message:
            d["reply_to_message"] = {"message_id": self.reply_to_message.message_id, "text": self.reply_to_message.text}
        if self.forward_from:
            d["forward_from"] = {"id": self.forward_from.id, "username": self.forward_from.username}
        if self.forward_from_chat:
            d["forward_from_chat"] = {"id": self.forward_from_chat.id, "title": self.forward_from_chat.title}
        if self.callback_query:
            d["callback_query"] = {"id": self.callback_query.id, "data": self.callback_query.data}
        return d

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

        # Parse all content types
        photo_data = data.get("photo")
        photo_list = [PhotoSize.from_dict(p) for p in photo_data] if photo_data and isinstance(photo_data, list) else None

        # Parse entities
        entities_data = data.get("entities") or data.get("caption_entities")
        entities_list = [MessageEntity.from_dict(e) for e in entities_data] if entities_data else None
        caption_entities_data = data.get("caption_entities")
        caption_entities_list = [MessageEntity.from_dict(e) for e in caption_entities_data] if caption_entities_data else None

        # Parse reply_to_message recursively
        reply_msg = Message.from_dict(data.get("reply_to_message")) if data.get("reply_to_message") else None

        # Parse forward_from_chat
        fwd_chat_data = data.get("forward_from_chat") or data.get("sender_chat")
        fwd_chat = Chat.from_dict(fwd_chat_data) if fwd_chat_data else None

        return cls(
            message_id=str(data.get("message_id") or data.get("id") or ""),
            text=data.get("text"),
            from_user=User.from_dict(data.get("from") or data.get("from_user")),
            chat=Chat.from_dict(data.get("chat")),
            date=date_value,
            raw=data,
            photo=photo_list,
            video=Video.from_dict(data.get("video")),
            document=Document.from_dict(data.get("document")),
            audio=Audio.from_dict(data.get("audio")),
            voice=Voice.from_dict(data.get("voice")),
            video_note=VideoNote.from_dict(data.get("video_note")),
            sticker=Sticker.from_dict(data.get("sticker")),
            location=Location.from_dict(data.get("location")),
            venue=Venue.from_dict(data.get("venue")),
            contact=Contact.from_dict(data.get("contact")),
            poll=Poll.from_dict(data.get("poll")),
            poll_answer=PollAnswer.from_dict(data.get("poll_answer")),
            dice=Dice.from_dict(data.get("dice")),
            game_short_name=data.get("game_short_name"),
            entities=entities_list,
            caption=data.get("caption"),
            caption_entities=caption_entities_list,
            reply_to_message=reply_msg,
            forward_from=User.from_dict(data.get("forward_from")),
            forward_from_chat=fwd_chat,
            forward_date=data.get("forward_date"),
            callback_query=None,
        )


@dataclass
class Update:
    update_id: str
    message: Optional[Message] = None
    callback_query: Optional[CallbackQuery] = None
    raw: Dict[str, Any] = field(default_factory=dict)

    @classmethod
    def from_dict(cls, data: Dict[str, Any]):
        if data is None:
            return None

        callback_data = data.get("callback_query")
        callback_query = CallbackQuery.from_dict(callback_data) if callback_data else None

        message_data = data.get("message")
        message = None
        if message_data:
            message = Message.from_dict(message_data)
            if callback_query and not message.callback_query:
                message.callback_query = callback_query

        # Also check for poll_answer at update level
        poll_answer_data = data.get("poll_answer")
        if poll_answer_data and not message:
            # Wrap poll_answer in a minimal Message
            message = Message(
                message_id="0",
                poll_answer=PollAnswer.from_dict(poll_answer_data),
                from_user=PollAnswer.from_dict(poll_answer_data).user if poll_answer_data.get("user") else None,
                raw=data,
            )

        return cls(
            update_id=str(data.get("update_id") or data.get("id") or ""),
            message=message,
            callback_query=callback_query,
            raw=data,
        )


# Legacy aliases
InlineKeyboardRow = None  # deprecated
InlineKeyboardMarkup = None  # deprecated


def _dataclass_to_dict(obj):
    """Generic dataclass → dict serializer."""
    if hasattr(obj, "__dataclass_fields__"):
        return {k: getattr(obj, k) for k in obj.__dataclass_fields__}
    return str(obj)
