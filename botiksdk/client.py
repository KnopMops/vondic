import json
import logging
from typing import Any, Dict, Optional

import requests

from botiksdk.exceptions import (
    APIError,
    BadRequestError,
    NotFoundError,
    UnauthorizedError,
)


class PublicAPIClient:
    def __init__(self, base_url: str = "http://localhost:5050"):
        normalized = (base_url or "http://localhost:5050").strip()
        if "://" not in normalized:
            normalized = f"http://{normalized}"
        self.base_url = normalized.rstrip("/")

    def _request(
        self,
        method: str,
        path: str,
        *,
        access_token: Optional[str] = None,
        api_key: Optional[str] = None,
        bot_token: Optional[str] = None,
        params: Optional[Dict[str, Any]] = None,
        json_body: Optional[Dict[str, Any]] = None,
    ):
        url = f"{self.base_url}{path}"
        logger = logging.getLogger(__name__)
        headers: Dict[str, str] = {"Content-Type": "application/json"}
        if access_token:
            headers["Authorization"] = f"Bearer {access_token}"
        if api_key:
            headers["X-API-Key"] = api_key
        if bot_token:
            headers["X-Bot-Token"] = bot_token
        try:
            response = requests.request(
                method,
                url,
                headers=headers,
                params=params,
                json=json_body,
                timeout=30,
            )
        except requests.RequestException:
            logger.exception(
                "botiksdk_request_error method=%s url=%s params=%s",
                method,
                url,
                params,
            )
            raise
        if response.ok:
            if not response.text:
                return None
            try:
                return response.json()
            except json.JSONDecodeError:
                return response.text
        payload = None
        try:
            payload = response.json()
        except json.JSONDecodeError:
            payload = response.text
        if response.status_code >= 400:
            text_preview = str(payload)
            if len(text_preview) > 500:
                text_preview = f"{text_preview[:500]}..."
            logger.info(
                "botiksdk_request_failed method=%s url=%s status=%s body=%s",
                method,
                url,
                response.status_code,
                text_preview,
            )
        if response.status_code == 401:
            raise UnauthorizedError(
                response.status_code, "Unauthorized", payload)
        if response.status_code == 404:
            raise NotFoundError(response.status_code, "Not Found", payload)
        if response.status_code == 400:
            raise BadRequestError(response.status_code, "Bad Request", payload)
        raise APIError(response.status_code, "API Error", payload)

    def list_bots(self):
        return self._request("GET", "/api/public/v1/bots")

    def get_bot(self, bot_id: str):
        return self._request("GET", f"/api/public/v1/bots/{bot_id}")

    def get_bot_by_name(self, name: str):
        return self._request("GET", f"/api/public/v1/bots/by-name/{name}")

    def search_bots(self, query: str):
        return self._request(
            "GET",
            "/api/public/v1/bots/search",
            params={
                "q": query})

    def generate_bot_token(self, bot_id: str, api_key: str):
        return self._request(
            "POST",
            f"/api/public/v1/bots/{bot_id}/token",
            api_key=api_key,
        )

    def get_updates(
        self,
        bot_id: str,
        bot_token: str,
        *,
        offset: int = 0,
        limit: int = 100,
        timeout: int = 20,
    ):
        data = self._request(
            "GET",
            f"/api/public/v1/bots/{bot_id}/updates",
            params={"offset": offset, "limit": limit, "timeout": timeout},
            bot_token=bot_token,
        )
        if isinstance(data, dict) and "items" in data:
            return data["items"]
        if data is None:
            return []
        return data

    def push_update(self, bot_id: str, bot_token: str,
                    message: Dict[str, Any]):
        return self._request(
            "POST",
            f"/api/public/v1/bots/{bot_id}/updates/push",
            json_body={"message": message},
            bot_token=bot_token,
        )

    def send_message(
            self,
            bot_id: str,
            bot_token: str,
            chat_id: str,
            text: str):
        return self._request(
            "POST",
            f"/api/public/v1/bots/{bot_id}/send",
            json_body={"chat_id": chat_id, "text": text},
            bot_token=bot_token,
        )

    def get_api_key(self, access_token: str):
        return self._request(
            "GET",
            "/api/public/v1/account/api-key",
            access_token=access_token,
        )

    def generate_api_key(self, access_token: str, rotate: bool = False):
        return self._request(
            "POST",
            "/api/public/v1/account/api-key",
            access_token=access_token,
            json_body={"rotate": rotate},
        )
