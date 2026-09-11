"""Сервис настроек маршрутизации звонков и WebRTC для корпоративной версии."""

from __future__ import annotations

import copy
from typing import Any, Dict

from app.core.database import AsyncSessionLocal
from app.models.app_setting import AppSetting
from sqlalchemy import select

CALL_ROUTING_KEY = "call_routing"

DEFAULT_CALL_ROUTING: dict = {
    "mode": "vondic_cloud",  # "vondic_cloud" | "self_hosted" | "hybrid"
    "ice_source": "vondic",  # "vondic" (стандартные серверы Vondic) | "custom" (свои STUN/TURN)
    "vondic_cloud": {
        "backend_url": "https://vondic.ru",
        "signaling_url": "https://vondic.ru",
        "webrtc_url": "https://webrtc.vondic.ru",
        "stun_urls": [
            "stun:vondic.ru:3478",
            "stun:webrtc.vondic.ru:3478",
            "stun:stun.l.google.com:19302",
        ],
        "turn_urls": [
            "turn:vondic.ru:3478?transport=udp",
            "turn:vondic.ru:3478?transport=tcp",
            "turn:webrtc.vondic.ru:3478?transport=udp",
            "turn:webrtc.vondic.ru:3478?transport=tcp",
        ],
        "turn_username": "vondic",
        "turn_password": "Dim4566212Len",
    },
    "self_hosted": {
        "backend_url": "http://localhost:5050",
        "signaling_url": "http://localhost:5000",
        "webrtc_url": "http://localhost:5000",
        "stun_urls": [
            "stun:192.168.140.11:3478",
            "stun:stun.l.google.com:19302",
        ],
        "turn_urls": [
            "turn:192.168.140.11:3478?transport=udp",
            "turn:192.168.140.11:3478?transport=tcp",
        ],
        "turn_username": "vondic",
        "turn_password": "Dim4566212Len",
    },
    "custom_ice": {
        "stun_urls": [
            "stun:stun.l.google.com:19302",
        ],
        "turn_urls": [],
        "turn_username": "",
        "turn_password": "",
    },
    "force_relay": False,
    "enable_fallback": True,
    "fallback_timeout_ms": 3500,
}


def _deep_merge(base: dict, patch: dict) -> dict:
    out = copy.deepcopy(base)
    for key, value in patch.items():
        if isinstance(value, dict) and isinstance(out.get(key), dict):
            out[key] = _deep_merge(out[key], value)
        else:
            out[key] = value
    return out


class CallRoutingService:
    @staticmethod
    async def get_routing_settings() -> dict:
        async with AsyncSessionLocal() as db:
            res = await db.execute(select(AppSetting).where(AppSetting.key == CALL_ROUTING_KEY))
            row = res.scalar_one_or_none()
            if not row or not row.value_json:
                return copy.deepcopy(DEFAULT_CALL_ROUTING)
            return _deep_merge(DEFAULT_CALL_ROUTING, row.value_json)

    @staticmethod
    async def update_routing_settings(patch: dict) -> dict:
        current = await CallRoutingService.get_routing_settings()
        merged = _deep_merge(current, patch or {})

        async with AsyncSessionLocal() as db:
            res = await db.execute(select(AppSetting).where(AppSetting.key == CALL_ROUTING_KEY))
            row = res.scalar_one_or_none()
            if not row:
                row = AppSetting(key=CALL_ROUTING_KEY, value_json=merged)
                db.add(row)
            else:
                row.value_json = merged
            await db.commit()

        return merged
