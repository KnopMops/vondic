import logging
from typing import Optional

from botiksdk.client import PublicAPIClient


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

    def get_updates(self, *, offset: int = 0, limit: int = 100, timeout: int = 20):
        self._ensure_ready()
        return self.public.get_updates(
            self.bot_id,
            self.token,
            offset=offset,
            limit=limit,
            timeout=timeout,
        )

    def send_message(self, chat_id: str, text: str):
        self._ensure_ready()
        logging.getLogger(__name__).info(
            "botiksdk_send_message bot_id=%s chat_id=%s text=%s",
            self.bot_id,
            chat_id,
            text,
        )
        return self.public.send_message(self.bot_id, self.token, chat_id, text)
