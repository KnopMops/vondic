"""Yandex Disk API integration for file storage."""

from __future__ import annotations

import io
import logging
import mimetypes

import requests

logger = logging.getLogger(__name__)

YANDEX_DISK_API = "https://cloud-api.yandex.net/v1/disk"
YANDEX_OAUTH_TOKEN_URL = "https://oauth.yandex.ru/token"


def refresh_yandex_token(refresh_token: str, client_id: str, client_secret: str) -> dict | None:
    """Refresh Yandex OAuth token."""
    try:
        resp = requests.post(YANDEX_OAUTH_TOKEN_URL, data={
            "grant_type": "refresh_token",
            "refresh_token": refresh_token,
            "client_id": client_id,
            "client_secret": client_secret,
        }, timeout=15)
        resp.raise_for_status()
        return resp.json()
    except Exception as e:
        logger.error("Failed to refresh Yandex token: %s", e)
        return None


class YandexDiskService:
    def __init__(self, access_token: str):
        self.token = access_token
        self.headers = {"Authorization": f"OAuth {access_token}"}

    def _request(self, method: str, url: str, **kwargs) -> requests.Response | None:
        try:
            resp = requests.request(method, url, headers=self.headers, timeout=30, **kwargs)
            if resp.status_code == 401:
                logger.error("Yandex Disk: unauthorized (token expired?)")
                return None
            return resp
        except Exception as e:
            logger.error("Yandex Disk request failed: %s", e)
            return None

    def ensure_dir(self, path: str) -> bool:
        """Create directory if it doesn't exist."""
        resp = self._request("PUT", f"{YANDEX_DISK_API}/resources",
                             params={"path": path, "overwrite": "false"})
        if resp and resp.status_code in (200, 201, 409):
            return True
        return resp is not None and resp.status_code == 409

    def upload_file(self, remote_path: str, file_bytes: bytes,
                    content_type: str | None = None) -> str | None:
        """Upload file to Yandex Disk and return public URL."""
        self.ensure_dir("/vondic")
        if '/' in remote_path:
            parent = remote_path.rsplit('/', 1)[0]
            self.ensure_dir(f"/vondic/{parent}")

        resp = self._request("GET", f"{YANDEX_DISK_API}/resources/upload",
                             params={"path": f"/vondic/{remote_path}", "overwrite": "true"})
        if not resp or resp.status_code != 200:
            logger.error("Failed to get upload URL: %s", resp.text if resp else "no response")
            return None

        upload_url = resp.json().get("href")
        if not upload_url:
            return None

        ct = content_type or mimetypes.guess_type(remote_path)[0] or "application/octet-stream"
        try:
            upload_resp = requests.put(
                upload_url,
                data=file_bytes,
                headers={"Content-Type": ct},
                timeout=120,
            )
            upload_resp.raise_for_status()
        except Exception as e:
            logger.error("Failed to upload to Yandex Disk: %s", e)
            return None

        public_url = self.publish_file(f"/vondic/{remote_path}")
        return public_url

    def publish_file(self, path: str) -> str | None:
        """Make file public and return public URL."""
        resp = self._request("PUT", f"{YANDEX_DISK_API}/resources/publish",
                             params={"path": path})
        if not resp or resp.status_code not in (200, 409):
            logger.error("Failed to publish: %s", resp.text if resp else "no response")

        resp = self._request("GET", f"{YANDEX_DISK_API}/resources",
                             params={"path": path, "fields": "public_url,name"})
        if resp and resp.status_code == 200:
            data = resp.json()
            public_url = data.get("public_url")
            if public_url:
                return public_url

        return None

    def delete_file(self, path: str) -> bool:
        """Delete file from Yandex Disk."""
        resp = self._request("DELETE", f"{YANDEX_DISK_API}/resources",
                             params={"path": f"/vondic/{path}", "permanently": "true"})
        return resp is not None and resp.status_code in (200, 204)

    def get_file_info(self, path: str) -> dict | None:
        """Get file info from Yandex Disk."""
        resp = self._request("GET", f"{YANDEX_DISK_API}/resources",
                             params={"path": f"/vondic/{path}", "fields": "name,size,public_url,created"})
        if resp and resp.status_code == 200:
            return resp.json()
        return None

    def get_download_url(self, path: str) -> str | None:
        """Get temporary download URL for a file."""
        resp = self._request("GET", f"{YANDEX_DISK_API}/resources/download",
                             params={"path": f"/vondic/{path}"})
        if resp and resp.status_code == 200:
            return resp.json().get("href")
        return None
