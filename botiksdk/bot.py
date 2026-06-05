import logging
import asyncio
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
        modal: Optional[str] = None,
    ):
        self.text = text
        self.callback_data = callback_data
        self.url = url
        self.modal = modal

    def to_dict(self) -> Dict[str, Any]:
        result = {"text": self.text}
        if self.modal:
            result["modal"] = self.modal
            if not self.callback_data:
                result["callback_data"] = f"ui:{self.modal}"
        if self.callback_data:
            result["callback_data"] = self.callback_data
        if self.url:
            result["url"] = self.url
        return result


def play_games_button(text: str = "Играть") -> InlineKeyboardButton:
    """Открывает список игр в чате с ботом (callback games:list)."""
    return InlineKeyboardButton(text, callback_data="games:list")


def game_play_button(game_id: str, title: str) -> InlineKeyboardButton:
    label = title if len(title) <= 28 else f"{title[:25]}…"
    return InlineKeyboardButton(label, callback_data=f"game:play:{game_id}")


def upload_game_button(text: str = "Загрузить игру") -> InlineKeyboardButton:
    return InlineKeyboardButton(text, modal="upload_game")


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

    def get_updates_sync(
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

    async def get_updates(
            self,
            *,
            offset: int = 0,
            limit: int = 100,
            timeout: int = 20):
        return await asyncio.to_thread(
            self.get_updates_sync,
            offset=offset,
            limit=limit,
            timeout=timeout,
        )

    def send_message_sync(
        self,
        chat_id: str,
        text: str,
        parse_mode: Optional[str] = None,
        reply_markup: Optional[Dict[str, Any]] = None,
        game: Optional[Dict[str, Any]] = None,
    ):
        self._ensure_ready()
        logger = logging.getLogger(__name__)
        logger.info(
            "botiksdk_send_message bot_id=%s chat_id=%s text=%s reply_markup=%s game=%s",
            self.bot_id,
            chat_id,
            text,
            reply_markup is not None,
            game is not None,
        )
        result = self.public.send_message(
            self.bot_id,
            self.token,
            chat_id,
            text,
            parse_mode=parse_mode,
            reply_markup=reply_markup,
            game=game,
        )
        logger.info("botiksdk_send_message_result bot_id=%s result=%s", self.bot_id, result)
        return result

    async def send_message(
        self,
        chat_id: str,
        text: str,
        parse_mode: Optional[str] = None,
        reply_markup: Optional[Dict[str, Any]] = None,
        game: Optional[Dict[str, Any]] = None,
    ):
        return await asyncio.to_thread(
            self.send_message_sync,
            chat_id,
            text,
            parse_mode=parse_mode,
            reply_markup=reply_markup,
            game=game,
        )

    def list_games_sync(self, query: Optional[str] = None):
        self._ensure_ready()
        return self.public.list_bot_games(
            self.bot_id, self.token, query=query
        )

    async def list_games(self, query: Optional[str] = None):
        return await asyncio.to_thread(self.list_games_sync, query)

    def send_game_sync(
        self,
        chat_id: str,
        game_id: str,
        *,
        text: Optional[str] = None,
        reply_markup: Optional[Dict[str, Any]] = None,
    ):
        return self.send_message_sync(
            chat_id,
            text or "🎮",
            game={"id": game_id},
            reply_markup=reply_markup,
        )

    async def send_game(
        self,
        chat_id: str,
        game_id: str,
        *,
        text: Optional[str] = None,
        reply_markup: Optional[Dict[str, Any]] = None,
    ):
        return await asyncio.to_thread(
            self.send_game_sync,
            chat_id,
            game_id,
            text=text,
            reply_markup=reply_markup,
        )

    def answer_callback_query_sync(
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

    async def answer_callback_query(
        self,
        callback_query_id: str,
        text: Optional[str] = None,
        show_alert: bool = False,
    ):
        return await asyncio.to_thread(
            self.answer_callback_query_sync,
            callback_query_id,
            text=text,
            show_alert=show_alert,
        )

    async def get_user_profile_photos(self, user_id: str, limit: int = 1):
        """Get user profile photos (returns mock data for local development)"""
        self._ensure_ready()
        try:
            result = await asyncio.to_thread(
                self.public.get_user_profile_photos,
                self.bot_id,
                self.token,
                user_id,
                0,
                limit,
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
            return await asyncio.to_thread(
                self.public.get_file, self.bot_id, self.token, file_id
            )
        except Exception:
            # Return mock data for local development
            return {
                "file_id": file_id,
                "file_path": "",
            }
