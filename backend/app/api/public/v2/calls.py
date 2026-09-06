"""Public API v2 — Calls & Voice Channels endpoints (API-key authenticated).

Bots can join/leave voice channels, list active calls, send audio,
and manage call state.  All real-time signaling is proxied to the
WebRTC service via HTTP internal endpoints.
"""
import json
import logging
import os
import asyncio
import uuid
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from app.api.public.v2.auth import get_bot_or_api_key_user

logger = logging.getLogger(__name__)

v2_calls_router = APIRouter(prefix="/api/public/v2/calls", tags=["Public API v2 — Calls"])

WEBRTC_INTERNAL_URL = os.getenv("WEBRTC_INTERNAL_URL", "http://webrtc:5000")


# ── Schemas ──────────────────────────────────────────────────────────

class JoinVoiceChannelSchema(BaseModel):
    channel_id: str


class LeaveVoiceChannelSchema(BaseModel):
    channel_id: str


class SendAudioToChannelSchema(BaseModel):
    channel_id: str
    audio_url: str
    filename: Optional[str] = None
    duration: Optional[int] = None


class InitiateCallSchema(BaseModel):
    target_user_id: str
    is_video: bool = False


class GroupCallSchema(BaseModel):
    group_id: str
    is_video: bool = False


class CallActionSchema(BaseModel):
    call_id: str
    action: str  # "answer" | "reject" | "end"


# ── Helpers ──────────────────────────────────────────────────────────

def _webrtc_request_sync(method: str, path: str, payload: dict = None) -> dict:
    """Synchronous HTTP request to WebRTC internal API."""
    import urllib.request
    url = f"{WEBRTC_INTERNAL_URL}{path}"
    try:
        data = json.dumps(payload or {}).encode("utf-8") if payload else None
        req = urllib.request.Request(
            url,
            data=data,
            headers={"Content-Type": "application/json"},
            method=method,
        )
        with urllib.request.urlopen(req, timeout=5) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except Exception as e:
        logger.warning("WebRTC request error %s %s: %s", method, path, e)
        return {"error": str(e)}


async def _webrtc_request(method: str, path: str, payload: dict = None) -> dict:
    return await asyncio.to_thread(_webrtc_request_sync, method, path, payload)


def _webrtc_emit_sync(event: str, payload: dict, room: str = None) -> dict:
    """Emit a Socket.IO event via WebRTC internal broadcast endpoint."""
    data = {
        "event": event,
        "payload": payload,
    }
    if room:
        data["room"] = room
    return _webrtc_request_sync("POST", "/internal/emit", data)


async def _webrtc_emit(event: str, payload: dict, room: str = None) -> dict:
    return await asyncio.to_thread(_webrtc_emit_sync, event, payload, room)


# ── Voice Channel Endpoints ──────────────────────────────────────────

@v2_calls_router.post("/voice-channels/join")
async def join_voice_channel(
    payload: JoinVoiceChannelSchema,
    auth: dict = Depends(get_bot_or_api_key_user),
):
    """Join a voice channel. Bot will appear as a participant."""
    user_id = auth["user_id"]

    # Notify WebRTC signaling about bot joining
    result = await _webrtc_emit(
        "join_voice_channel",
        {
            "channel_id": payload.channel_id,
            "user_id": user_id,
            "is_bot": auth["auth_type"] == "bot",
            "bot_id": auth.get("bot_id"),
        },
        room=payload.channel_id,
    )

    return {
        "ok": True,
        "channel_id": payload.channel_id,
        "user_id": user_id,
        "status": "joined",
    }


@v2_calls_router.post("/voice-channels/leave")
async def leave_voice_channel(
    payload: LeaveVoiceChannelSchema,
    auth: dict = Depends(get_bot_or_api_key_user),
):
    """Leave a voice channel."""
    user_id = auth["user_id"]

    result = await _webrtc_emit(
        "leave_voice_channel",
        {
            "channel_id": payload.channel_id,
            "user_id": user_id,
        },
        room=payload.channel_id,
    )

    return {
        "ok": True,
        "channel_id": payload.channel_id,
        "user_id": user_id,
        "status": "left",
    }


@v2_calls_router.get("/voice-channels/{channel_id}/participants")
async def get_voice_channel_participants(
    channel_id: str,
    auth: dict = Depends(get_bot_or_api_key_user),
):
    """Get list of participants in a voice channel."""
    result = await _webrtc_request("GET", f"/internal/voice-channels/{channel_id}/participants")
    return {
        "ok": True,
        "channel_id": channel_id,
        "participants": result.get("participants", []),
    }


@v2_calls_router.get("/voice-channels/active")
async def list_active_voice_channels(
    auth: dict = Depends(get_bot_or_api_key_user),
):
    """List all active voice channels with participant counts."""
    result = await _webrtc_request("GET", "/internal/voice-channels/active")
    return {
        "ok": True,
        "channels": result.get("channels", []),
    }


@v2_calls_router.post("/voice-channels/send-audio")
async def send_audio_to_voice_channel(
    payload: SendAudioToChannelSchema,
    auth: dict = Depends(get_bot_or_api_key_user),
):
    """Send/play an audio file in a voice channel.

    The bot must have already joined the channel.
    The audio_url should be a publicly accessible URL or an S3 presigned URL.
    """
    user_id = auth["user_id"]

    audio_payload = {
        "channel_id": payload.channel_id,
        "user_id": user_id,
        "bot_id": auth.get("bot_id"),
        "audio_url": payload.audio_url,
        "filename": payload.filename or "audio.mp3",
        "duration": payload.duration,
        "timestamp": __import__("time").time(),
    }

    result = await _webrtc_emit(
        "voice_channel_audio",
        audio_payload,
        room=payload.channel_id,
    )

    return {
        "ok": True,
        "channel_id": payload.channel_id,
        "audio_url": payload.audio_url,
        "status": "sent",
    }


# ── Direct Call Endpoints ────────────────────────────────────────────

@v2_calls_router.post("/initiate")
async def initiate_call(
    payload: InitiateCallSchema,
    auth: dict = Depends(get_bot_or_api_key_user),
):
    """Initiate a 1:1 call to a user. Returns a call_id for tracking."""
    caller_id = auth["user_id"]
    call_id = f"call-{caller_id}-{int(__import__('time').time() * 1000)}"

    call_data = {
        "call_id": call_id,
        "caller_user_id": caller_id,
        "caller_username": "Bot" if auth["auth_type"] == "bot" else (auth["user"].username if auth.get("user") else "User"),
        "target_user_id": payload.target_user_id,
        "is_video": payload.is_video,
        "is_bot": auth["auth_type"] == "bot",
        "bot_id": auth.get("bot_id"),
    }

    # Emit incoming_call to target user
    await _webrtc_emit("incoming_call", call_data, room=payload.target_user_id)

    return {
        "ok": True,
        "call_id": call_id,
        "target_user_id": payload.target_user_id,
        "status": "ringing",
    }


@v2_calls_router.post("/group/initiate")
async def initiate_group_call(
    payload: GroupCallSchema,
    auth: dict = Depends(get_bot_or_api_key_user),
):
    """Initiate a group call. All group members will be notified."""
    caller_id = auth["user_id"]
    call_id = str(uuid.uuid4())

    # Get group participants
    participants = []
    try:
        from app.core.database import get_async_session
        from sqlalchemy import text
        async for db in get_async_session():
            res = await db.execute(
                text("SELECT user_id FROM group_members WHERE group_id = :gid"),
                {"gid": payload.group_id},
            )
            participants = [str(row[0]) for row in res.fetchall()]
    except Exception as e:
        logger.warning("get group participants error: %s", e)

    call_data = {
        "call_id": call_id,
        "group_id": payload.group_id,
        "caller_user_id": caller_id,
        "is_video": payload.is_video,
        "is_bot": auth["auth_type"] == "bot",
        "bot_id": auth.get("bot_id"),
    }

    # Notify all participants
    for pid in participants:
        if str(pid) != str(caller_id):
            await _webrtc_emit("incoming_group_call", call_data, room=pid)

    return {
        "ok": True,
        "call_id": call_id,
        "group_id": payload.group_id,
        "participants_notified": len(participants) - 1,
        "status": "ringing",
    }


@v2_calls_router.post("/answer")
async def answer_call(
    payload: CallActionSchema,
    auth: dict = Depends(get_bot_or_api_key_user),
):
    """Answer an incoming call."""
    await _webrtc_emit(
        "call_answer",
        {
            "call_id": payload.call_id,
            "user_id": auth["user_id"],
            "is_bot": auth["auth_type"] == "bot",
        },
    )
    return {"ok": True, "call_id": payload.call_id, "status": "answered"}


@v2_calls_router.post("/reject")
async def reject_call(
    payload: CallActionSchema,
    auth: dict = Depends(get_bot_or_api_key_user),
):
    """Reject an incoming call."""
    await _webrtc_emit(
        "call_reject",
        {
            "call_id": payload.call_id,
            "user_id": auth["user_id"],
            "reason": "rejected",
        },
    )
    return {"ok": True, "call_id": payload.call_id, "status": "rejected"}


@v2_calls_router.post("/end")
async def end_call(
    payload: CallActionSchema,
    auth: dict = Depends(get_bot_or_api_key_user),
):
    """End an active call."""
    await _webrtc_emit(
        "call_end",
        {
            "call_id": payload.call_id,
            "user_id": auth["user_id"],
        },
    )
    return {"ok": True, "call_id": payload.call_id, "status": "ended"}


@v2_calls_router.get("/active")
async def list_active_calls(
    auth: dict = Depends(get_bot_or_api_key_user),
):
    """List all active calls (1:1 and group)."""
    result = await _webrtc_request("GET", "/internal/calls/active")
    return {
        "ok": True,
        "calls": result.get("calls", []),
    }


@v2_calls_router.get("/{call_id}")
async def get_call_status(
    call_id: str,
    auth: dict = Depends(get_bot_or_api_key_user),
):
    """Get status of a specific call."""
    result = await _webrtc_request("GET", f"/internal/calls/{call_id}")
    if "error" in result:
        raise HTTPException(status_code=404, detail="Call not found")
    return {"ok": True, "call": result}
