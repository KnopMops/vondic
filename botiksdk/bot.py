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

    def get_updates(self, *, offset: int = 0, limit: int = 100, timeout: int = 20):
        return self.public.get_updates(
            self.bot_id,
            self.token,
            offset=offset,
            limit=limit,
            timeout=timeout,
        )

    def send_message(self, chat_id: str, text: str):
        return self.public.send_message(self.bot_id, self.token, chat_id, text)
