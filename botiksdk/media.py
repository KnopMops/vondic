"""InputMedia types for send_media_group (albums)."""
from typing import Optional, Union


class InputMedia:
    """Base class for media in a media group."""

    def __init__(self, media_type: str, media, caption: Optional[str] = None,
                 parse_mode: Optional[str] = None):
        self.type = media_type
        self.media = media
        self.caption = caption
        self.parse_mode = parse_mode

    def to_dict(self) -> dict:
        d = {"type": self.type, "media": self._encode_media(self.media)}
        if self.caption:
            d["caption"] = self.caption
        if self.parse_mode:
            d["parse_mode"] = self.parse_mode
        return d

    @staticmethod
    def _encode_media(media):
        if hasattr(media, "to_base64"):
            return f"data:file;base64,{media.to_base64()}"
        return str(media)


class InputMediaPhoto(InputMedia):
    def __init__(self, media, caption: Optional[str] = None,
                 parse_mode: Optional[str] = None):
        super().__init__("photo", media, caption, parse_mode)


class InputMediaVideo(InputMedia):
    def __init__(self, media, caption: Optional[str] = None,
                 parse_mode: Optional[str] = None,
                 width: Optional[int] = None, height: Optional[int] = None,
                 duration: Optional[int] = None):
        super().__init__("video", media, caption, parse_mode)
        self.width = width
        self.height = height
        self.duration = duration

    def to_dict(self) -> dict:
        d = super().to_dict()
        if self.width:
            d["width"] = self.width
        if self.height:
            d["height"] = self.height
        if self.duration:
            d["duration"] = self.duration
        return d


class InputMediaDocument(InputMedia):
    def __init__(self, media, caption: Optional[str] = None,
                 parse_mode: Optional[str] = None):
        super().__init__("document", media, caption, parse_mode)


class InputMediaAudio(InputMedia):
    def __init__(self, media, caption: Optional[str] = None,
                 parse_mode: Optional[str] = None,
                 duration: Optional[int] = None, performer: Optional[str] = None,
                 title: Optional[str] = None):
        super().__init__("audio", media, caption, parse_mode)
        self.duration = duration
        self.performer = performer
        self.title = title

    def to_dict(self) -> dict:
        d = super().to_dict()
        if self.duration:
            d["duration"] = self.duration
        if self.performer:
            d["performer"] = self.performer
        if self.title:
            d["title"] = self.title
        return d
