"""Location, Venue, Contact types."""
from dataclasses import dataclass, field
from typing import Optional


@dataclass
class Location:
    latitude: float = 0.0
    longitude: float = 0.0

    @classmethod
    def from_dict(cls, data: dict) -> "Location":
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
    def from_dict(cls, data: dict) -> "Venue":
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
    def from_dict(cls, data: dict) -> "Contact":
        return cls(
            phone_number=data.get("phone_number", ""),
            first_name=data.get("first_name", ""),
            last_name=data.get("last_name"),
            user_id=data.get("user_id"),
            vcard=data.get("vcard"),
        )


@dataclass
class ChatFull:
    id: str = ""
    type: str = "private"
    title: Optional[str] = None
    username: Optional[str] = None
    description: Optional[str] = None
    invite_link: Optional[str] = None
    member_count: Optional[int] = None
    slow_mode_delay: Optional[int] = None
    has_aggressive_anti_spam: Optional[bool] = None
    has_hidden_members: Optional[bool] = None

    @classmethod
    def from_dict(cls, data: dict) -> "ChatFull":
        return cls(
            id=str(data.get("id", "")),
            type=data.get("type", "private"),
            title=data.get("title"),
            username=data.get("username"),
            description=data.get("description"),
            invite_link=data.get("invite_link"),
            member_count=data.get("member_count"),
            slow_mode_delay=data.get("slow_mode_delay"),
            has_aggressive_anti_spam=data.get("has_aggressive_anti_spam"),
            has_hidden_members=data.get("has_hidden_members"),
        )


@dataclass
class ChatPermissions:
    can_send_messages: bool = True
    can_send_audios: bool = True
    can_send_documents: bool = True
    can_send_photos: bool = True
    can_send_videos: bool = True
    can_send_video_notes: bool = True
    can_send_voice_notes: bool = True
    can_send_polls: bool = True
    can_send_other_messages: bool = True
    can_add_web_page_previews: bool = True
    can_change_info: bool = False
    can_invite_users: bool = True
    can_pin_messages: bool = False
    can_manage_topics: bool = False

    def to_dict(self) -> dict:
        return {k: v for k, v in self.__dict__.items()}

    @classmethod
    def from_dict(cls, data: dict) -> "ChatPermissions":
        return cls(**{k: v for k, v in data.items() if k in cls.__dataclass_fields__})


@dataclass
class ChatMember:
    user_id: str = ""
    status: str = "member"
    until_date: Optional[int] = None
    can_be_edited: Optional[bool] = None
    can_send_messages: Optional[bool] = None
    can_send_polls: Optional[bool] = None
    can_change_info: Optional[bool] = None
    can_invite_users: Optional[bool] = None
    can_pin_messages: Optional[bool] = None

    @classmethod
    def from_dict(cls, data: dict) -> "ChatMember":
        return cls(**{k: v for k, v in data.items() if k in cls.__dataclass_fields__})


@dataclass
class InviteLink:
    invite_link: str = ""
    name: Optional[str] = None
    expire_date: Optional[int] = None
    member_limit: Optional[int] = None
    creates_join_request: bool = False

    @classmethod
    def from_dict(cls, data: dict) -> "InviteLink":
        return cls(**{k: v for k, v in data.items() if k in cls.__dataclass_fields__})
