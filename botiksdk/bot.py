import logging
from typing import Any, Dict, List, Optional

from botiksdk.client import PublicAPIClient


class InlineKeyboardBuilder:
    """Builder for inline keyboard markup"""

    def __init__(self):
        self._rows: List[List[Dict[str, Any]]] = []
        self._current_row: List[Dict[str, Any]] = []

    def row(self, *buttons: "InlineKeyboardButton") -> "InlineKeyboardBuilder":
        """Add a row of buttons"""
        if self._current_row:
            self._rows.append(self._current_row)
            self._current_row = []
        for btn in buttons:
            self._current_row.append(btn.to_dict())
        return self

    def add(self, button: "InlineKeyboardButton") -> "InlineKeyboardBuilder":
        """Add a button to the current row"""
        self._current_row.append(button.to_dict())
        return self

    def as_markup(self) -> Dict[str, Any]:
        """Build the inline keyboard markup"""
        if self._current_row:
            self._rows.append(self._current_row)
        return {"inline_keyboard": self._rows}


class InlineKeyboardButton:
    """Inline keyboard button"""

    def __init__(
        self,
        text: str,
        callback_data: Optional[str] = None,
        url: Optional[str] = None,
    ):
        self.text = text
        self.callback_data = callback_data
        self.url = url

    def to_dict(self) -> Dict[str, Any]:
        result = {"text": self.text}
        if self.callback_data:
            result["callback_data"] = self.callback_data
        if self.url:
            result["url"] = self.url
        return result


class Bot:
    def __init__(
        self,
        bot_id: Optional[str] = None,
        token: Optional[str] = None,
        *,
        base_url: str = "http://localhost:5050",
        api_key: Optional[str] = None,
    ):
        self.bot_id = bot_id
        self.token = token
        self.api_key = api_key
        self.public = PublicAPIClient(base_url=base_url)

    def set_token(self, token: str):
        self.token = token
        return self

    def set_bot_id(self, bot_id: str):
        self.bot_id = bot_id
        return self

    def set_api_key(self, api_key: str):
        self.api_key = api_key
        return self

    def _ensure_ready(self):
        if not self.bot_id:
            raise ValueError("bot_id is required")
        if not self.token:
            raise ValueError("bot token is required")

    def get_updates(
            self,
            *,
            offset: int = 0,
            limit: int = 100,
            timeout: int = 20):
        self._ensure_ready()
        return self.public.get_updates(
            self.bot_id,
            self.token,
            offset=offset,
            limit=limit,
            timeout=timeout,
        )

    def send_message(
        self,
        chat_id: str,
        text: str,
        parse_mode: Optional[str] = None,
        reply_markup: Optional[Dict[str, Any]] = None,
    ):
        self._ensure_ready()
        logger = logging.getLogger(__name__)
        logger.info(
            "botiksdk_send_message bot_id=%s chat_id=%s text=%s reply_markup=%s",
            self.bot_id,
            chat_id,
            text,
            reply_markup is not None,
        )
        result = self.public.send_message(
            self.bot_id,
            self.token,
            chat_id,
            text,
            parse_mode=parse_mode,
            reply_markup=reply_markup,
        )
        logger.info("botiksdk_send_message_result bot_id=%s result=%s", self.bot_id, result)
        return result

    def answer_callback_query(
        self,
        callback_query_id: str,
        text: Optional[str] = None,
        show_alert: bool = False,
    ):
        self._ensure_ready()
        return self.public.answer_callback_query(
            self.bot_id,
            self.token,
            callback_query_id,
            text=text,
            show_alert=show_alert,
        )

    async def get_user_profile_photos(self, user_id: str, limit: int = 1):
        """Get user profile photos (returns mock data for local development)"""
        self._ensure_ready()
        try:
            result = self.public.get_user_profile_photos(
                self.bot_id,
                self.token,
                user_id,
                offset=0,
                limit=limit,
            )
            return result
        except Exception:
            # Return mock data for local development
            return {
                "total_count": 0,
                "photos": [],
            }

    async def get_file(self, file_id: str):
        """Get file by ID (returns mock data for local development)"""
        self._ensure_ready()
        try:
            return self.public.get_file(self.bot_id, self.token, file_id)
        except Exception:
            # Return mock data for local development
            return {
                "file_id": file_id,
                "file_path": "",
            }
