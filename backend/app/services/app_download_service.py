"""Настройки версий и ссылок для страниц загрузки приложений."""

from __future__ import annotations

import copy

from app.core.extensions import db
from app.models.app_setting import APP_DOWNLOADS_KEY, AppSetting

DEFAULT_APP_DOWNLOADS: dict = {
    "desktop": {
        "version": "v1.0.1",
        "github_release_url": (
            "https://github.com/KnopMops/vondic/releases/tag/vondic-desktop"
        ),
        "windows_download_url": (
            "https://github.com/KnopMops/vondic/releases/download/"
            "vondic-desktop/portable.zip"
        ),
        "macos_download_url": "",
        "linux_download_url": "",
        "windows_available": True,
        "macos_available": False,
        "linux_available": False,
    },
    "mobile": {
        "version": "1.0.0",
        "android_download_url": "",
        "ios_download_url": "",
        "android_available": False,
        "ios_available": False,
    },
}


def _deep_merge(base: dict, patch: dict) -> dict:
    out = copy.deepcopy(base)
    for key, value in patch.items():
        if isinstance(value, dict) and isinstance(out.get(key), dict):
            out[key] = _deep_merge(out[key], value)
        else:
            out[key] = value
    return out


class AppDownloadService:
    @staticmethod
    def get_downloads() -> dict:
        row = AppSetting.query.get(APP_DOWNLOADS_KEY)
        if not row or not row.value_json:
            return copy.deepcopy(DEFAULT_APP_DOWNLOADS)
        return _deep_merge(DEFAULT_APP_DOWNLOADS, row.value_json)

    @staticmethod
    def update_downloads(patch: dict) -> dict:
        current = AppDownloadService.get_downloads()
        merged = _deep_merge(current, patch or {})
        row = AppSetting.query.get(APP_DOWNLOADS_KEY)
        if not row:
            row = AppSetting(key=APP_DOWNLOADS_KEY, value_json=merged)
            db.session.add(row)
        else:
            row.value_json = merged
        db.session.commit()
        return merged
