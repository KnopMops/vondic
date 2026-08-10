"""Extended Bot methods — media, moderation, polls, stickers, callbacks, location, inline, webhook."""
import json
import logging
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


def _strip_none(d: dict) -> dict:
    return {k: v for k, v in d.items() if v is not None}


def _encode_media(media):
    if hasattr(media, "to_base64"):
        return f"data:file;base64,{media.to_base64()}"
    return str(media)


class BotMethodsMixin:
    """Mixin with extended bot methods. Mixed into the Bot class."""

    # ── Media ────────────────────────────────────────────────────────

    async def send_photo(self, chat_id: str, photo, caption: str = None,
                         reply_to: str = None, reply_markup=None) -> dict:
        payload = _strip_none({
            "chat_id": chat_id,
            "photo": _encode_media(photo),
            "filename": getattr(photo, 'filename', None),
            "caption": caption,
            "reply_to_message_id": reply_to,
            "reply_markup": reply_markup,
        })
        return await self._send_action("send_photo", payload)

    async def send_document(self, chat_id: str, document, caption: str = None,
                            reply_to: str = None) -> dict:
        payload = _strip_none({
            "chat_id": chat_id,
            "document": _encode_media(document),
            "filename": getattr(document, 'filename', None),
            "caption": caption,
            "reply_to_message_id": reply_to,
        })
        return await self._send_action("send_document", payload)

    async def send_voice(self, chat_id: str, voice, caption: str = None,
                         reply_to: str = None) -> dict:
        payload = _strip_none({
            "chat_id": chat_id,
            "voice": _encode_media(voice),
            "filename": getattr(voice, 'filename', None),
            "caption": caption,
            "reply_to_message_id": reply_to,
        })
        return await self._send_action("send_voice", payload)

    async def send_video(self, chat_id: str, video, caption: str = None,
                         reply_to: str = None) -> dict:
        payload = _strip_none({
            "chat_id": chat_id,
            "video": _encode_media(video),
            "filename": getattr(video, 'filename', None),
            "caption": caption,
            "reply_to_message_id": reply_to,
        })
        return await self._send_action("send_video", payload)

    async def send_video_note(self, chat_id: str, video_note, reply_to: str = None) -> dict:
        payload = _strip_none({
            "chat_id": chat_id,
            "video_note": _encode_media(video_note),
            "filename": getattr(video_note, 'filename', None),
            "reply_to_message_id": reply_to,
        })
        return await self._send_action("send_video_note", payload)

    async def send_media_group(self, chat_id: str, media: list) -> dict:
        """Send a group of photos/videos/documents as an album."""
        media_data = []
        for m in media:
            if hasattr(m, "to_dict"):
                media_data.append(m.to_dict())
            elif isinstance(m, dict):
                media_data.append(m)
        return await self._send_action("send_media_group", {
            "chat_id": chat_id, "media": media_data,
        })

    async def send_audio(self, chat_id: str, audio, caption: str = None,
                         reply_to: str = None, performer: str = None,
                         title: str = None) -> dict:
        payload = _strip_none({
            "chat_id": chat_id,
            "audio": _encode_media(audio),
            "filename": getattr(audio, 'filename', None),
            "caption": caption,
            "reply_to_message_id": reply_to,
            "performer": performer,
            "title": title,
        })
        return await self._send_action("send_audio", payload)

    async def send_animation(self, chat_id: str, animation, caption: str = None,
                             reply_to: str = None) -> dict:
        payload = _strip_none({
            "chat_id": chat_id,
            "animation": _encode_media(animation),
            "caption": caption,
            "reply_to_message_id": reply_to,
        })
        return await self._send_action("send_animation", payload)

    # ── Editing ──────────────────────────────────────────────────────

    async def edit_message_media(self, chat_id: str, message_id: str, media) -> dict:
        media_dict = media.to_dict() if hasattr(media, "to_dict") else media
        return await self._send_action("edit_message_media", {
            "chat_id": chat_id, "message_id": message_id, "media": media_dict,
        })

    async def edit_message_caption(self, chat_id: str, message_id: str,
                                   caption: str = None, parse_mode: str = None) -> dict:
        return await self._send_action("edit_message_caption", _strip_none({
            "chat_id": chat_id, "message_id": message_id,
            "caption": caption, "parse_mode": parse_mode,
        }))

    async def edit_message_text(self, text: str, chat_id: str = None,
                                message_id: str = None, reply_markup=None) -> dict:
        return await self._send_action("edit_message_text", {
            "text": text, "chat_id": chat_id, "message_id": message_id,
            "reply_markup": reply_markup,
        })

    async def edit_message_reply_markup(self, chat_id: str = None,
                                        message_id: str = None, reply_markup=None) -> dict:
        return await self._send_action("edit_message_reply_markup", {
            "chat_id": chat_id, "message_id": message_id, "reply_markup": reply_markup,
        })

    # ── Location / Venue / Contact ───────────────────────────────────

    async def send_location(self, chat_id: str, latitude: float, longitude: float,
                            reply_to: str = None) -> dict:
        return await self._send_action("send_location", _strip_none({
            "chat_id": chat_id, "latitude": latitude, "longitude": longitude,
            "reply_to_message_id": reply_to,
        }))

    async def send_venue(self, chat_id: str, latitude: float, longitude: float,
                         title: str, address: str, reply_to: str = None) -> dict:
        return await self._send_action("send_venue", _strip_none({
            "chat_id": chat_id, "latitude": latitude, "longitude": longitude,
            "title": title, "address": address,
            "reply_to_message_id": reply_to,
        }))

    async def send_contact(self, chat_id: str, phone_number: str, first_name: str,
                           last_name: str = None, reply_to: str = None) -> dict:
        return await self._send_action("send_contact", _strip_none({
            "chat_id": chat_id, "phone_number": phone_number,
            "first_name": first_name, "last_name": last_name,
            "reply_to_message_id": reply_to,
        }))

    # ── Batch operations ─────────────────────────────────────────────

    async def delete_messages(self, chat_id: str, message_ids: list) -> dict:
        return await self._send_action("delete_messages", {
            "chat_id": chat_id, "message_ids": message_ids,
        })

    async def forward_messages(self, from_chat_id: str, to_chat_id: str,
                               message_ids: list) -> dict:
        return await self._send_action("forward_messages", {
            "from_chat_id": from_chat_id, "to_chat_id": to_chat_id,
            "message_ids": message_ids,
        })

    async def copy_messages(self, from_chat_id: str, to_chat_id: str,
                            message_ids: list) -> dict:
        return await self._send_action("copy_messages", {
            "from_chat_id": from_chat_id, "to_chat_id": to_chat_id,
            "message_ids": message_ids,
        })

    # ── Moderation ───────────────────────────────────────────────────

    async def ban_chat_member(self, chat_id: str, user_id: str) -> dict:
        return await self._send_action("ban_chat_member", {"chat_id": chat_id, "user_id": user_id})

    async def unban_chat_member(self, chat_id: str, user_id: str) -> dict:
        return await self._send_action("unban_chat_member", {"chat_id": chat_id, "user_id": user_id})

    async def kick_chat_member(self, chat_id: str, user_id: str) -> dict:
        return await self._send_action("kick_chat_member", {"chat_id": chat_id, "user_id": user_id})

    async def restrict_chat_member(self, chat_id: str, user_id: str, permissions: dict = None) -> dict:
        return await self._send_action("restrict_chat_member", {
            "chat_id": chat_id, "user_id": user_id, "permissions": permissions or {},
        })

    async def promote_chat_member(self, chat_id: str, user_id: str, **kwargs) -> dict:
        return await self._send_action("promote_chat_member", {"chat_id": chat_id, "user_id": user_id, **kwargs})

    async def approve_join_request(self, chat_id: str, user_id: str) -> dict:
        return await self._send_action("approve_join_request", {"chat_id": chat_id, "user_id": user_id})

    async def decline_join_request(self, chat_id: str, user_id: str) -> dict:
        return await self._send_action("decline_join_request", {"chat_id": chat_id, "user_id": user_id})


    async def set_chat_permissions(self, chat_id: str, permissions: dict) -> dict:
        return await self._send_action("set_chat_permissions", {
            "chat_id": chat_id, "permissions": permissions,
        })

    # ── Chat management ──────────────────────────────────────────────

    async def set_chat_title(self, chat_id: str, title: str) -> dict:
        return await self._send_action("set_chat_title", {"chat_id": chat_id, "title": title})

    async def set_chat_description(self, chat_id: str, description: str) -> dict:
        return await self._send_action("set_chat_description", {
            "chat_id": chat_id, "description": description,
        })

    async def get_chat(self, chat_id: str) -> dict:
        return await self._send_action("get_chat", {"chat_id": chat_id})

    async def get_chat_members_count(self, chat_id: str) -> dict:
        return await self._send_action("get_chat_members_count", {"chat_id": chat_id})

    async def get_chat_member(self, chat_id: str, user_id: str) -> dict:
        return await self._send_action("get_chat_member", {"chat_id": chat_id, "user_id": user_id})

    async def leave_chat(self, chat_id: str) -> dict:
        return await self._send_action("leave_chat", {"chat_id": chat_id})

    # ── Message operations ───────────────────────────────────────────

    async def delete_message(self, chat_id: str, message_id: str) -> dict:
        return await self._send_action("delete_message", {"chat_id": chat_id, "message_id": message_id})

    async def forward_message(self, from_chat_id: str, to_chat_id: str, message_id: str) -> dict:
        return await self._send_action("forward_message", {
            "from_chat_id": from_chat_id, "to_chat_id": to_chat_id, "message_id": message_id,
        })

    async def copy_message(self, from_chat_id: str, to_chat_id: str, message_id: str) -> dict:
        return await self._send_action("copy_message", {
            "from_chat_id": from_chat_id, "to_chat_id": to_chat_id, "message_id": message_id,
        })

    async def pin_chat_message(self, chat_id: str, message_id: str, disable_notification: bool = False) -> dict:
        return await self._send_action("pin_chat_message", {
            "chat_id": chat_id, "message_id": message_id,
            "disable_notification": disable_notification,
        })

    async def unpin_chat_message(self, chat_id: str, message_id: str = None) -> dict:
        return await self._send_action("unpin_chat_message", _strip_none({
            "chat_id": chat_id, "message_id": message_id,
        }))

    async def unpin_all_chat_messages(self, chat_id: str) -> dict:
        return await self._send_action("unpin_all_chat_messages", {"chat_id": chat_id})

    # ── Invite links ─────────────────────────────────────────────────

    async def export_chat_invite_link(self, chat_id: str) -> dict:
        return await self._send_action("export_chat_invite_link", {"chat_id": chat_id})

    async def create_chat_invite_link(self, chat_id: str, name: str = None,
                                      expire_date: int = None,
                                      member_limit: int = None) -> dict:
        return await self._send_action("create_chat_invite_link", _strip_none({
            "chat_id": chat_id, "name": name,
            "expire_date": expire_date, "member_limit": member_limit,
        }))

    async def revoke_chat_invite_link(self, chat_id: str, invite_link: str) -> dict:
        return await self._send_action("revoke_chat_invite_link", {
            "chat_id": chat_id, "invite_link": invite_link,
        })

    # ── Polls ────────────────────────────────────────────────────────

    async def send_poll(self, chat_id: str, question: str, options: List[str],
                        is_anonymous: bool = True, allows_multiple_answers: bool = False) -> dict:
        return await self._send_action("send_poll", {
            "chat_id": chat_id, "question": question, "options": options,
            "is_anonymous": is_anonymous, "allows_multiple_answers": allows_multiple_answers,
        })

    async def stop_poll(self, chat_id: str, message_id: str) -> dict:
        return await self._send_action("stop_poll", {"chat_id": chat_id, "message_id": message_id})

    # ── Callback actions ─────────────────────────────────────────────

    async def answer_callback_query(self, callback_id: str, text: str = None,
                                    show_alert: bool = False) -> dict:
        return await self._send_action("answer_callback_query", {
            "callback_query_id": callback_id, "text": text, "show_alert": show_alert,
        })

    # ── Stickers ─────────────────────────────────────────────────────

    async def send_sticker(self, chat_id: str, sticker_id: str, reply_to: str = None) -> dict:
        return await self._send_action("send_sticker", {
            "chat_id": chat_id, "sticker_id": sticker_id, "reply_to": reply_to,
        })

    async def get_sticker_set(self, name: str) -> dict:
        return await self._send_action("get_sticker_set", {"name": name})

    async def create_new_sticker_set(self, user_id: str, name: str, title: str,
                                     stickers: list) -> dict:
        return await self._send_action("create_new_sticker_set", {
            "user_id": user_id, "name": name, "title": title, "stickers": stickers,
        })

    async def add_sticker_to_set(self, user_id: str, name: str, sticker: dict) -> dict:
        return await self._send_action("add_sticker_to_set", {
            "user_id": user_id, "name": name, "sticker": sticker,
        })

    async def set_sticker_set_title(self, name: str, title: str) -> dict:
        return await self._send_action("set_sticker_set_title", {"name": name, "title": title})

    async def delete_sticker_set(self, name: str) -> dict:
        return await self._send_action("delete_sticker_set", {"name": name})

    # ── Bot commands ─────────────────────────────────────────────────

    async def set_my_commands(self, commands: List[Dict[str, str]]) -> dict:
        return await self._send_action("set_my_commands", {"commands": commands})

    async def get_my_commands(self) -> list:
        return await self._send_action("get_my_commands", {})

    async def delete_my_commands(self, scope: dict = None) -> dict:
        return await self._send_action("delete_my_commands", _strip_none({"scope": scope}))

    # ── Chat actions ─────────────────────────────────────────────────

    async def send_chat_action(self, chat_id: str, action: str) -> dict:
        return await self._send_action("send_chat_action", {"chat_id": chat_id, "action": action})

    # ── Inline queries ───────────────────────────────────────────────

    async def answer_inline_query(self, query_id: str, results: list,
                                  cache_time: int = None,
                                  switch_pm_text: str = None) -> dict:
        return await self._send_action("answer_inline_query", _strip_none({
            "inline_query_id": query_id, "results": results,
            "cache_time": cache_time, "switch_pm_text": switch_pm_text,
        }))

    # ── Games ────────────────────────────────────────────────────────

    async def set_game_score(self, user_id: int, score: int,
                             force: bool = None,
                             disable_edit_message: bool = None,
                             chat_id: str = None,
                             message_id: str = None) -> dict:
        return await self._send_action("set_game_score", _strip_none({
            "user_id": user_id, "score": score,
            "force": force, "disable_edit_message": disable_edit_message,
            "chat_id": chat_id, "message_id": message_id,
        }))

    async def get_game_high_scores(self, user_id: int,
                                   chat_id: str = None,
                                   message_id: str = None) -> dict:
        return await self._send_action("get_game_high_scores", _strip_none({
            "user_id": user_id, "chat_id": chat_id, "message_id": message_id,
        }))

    # ── Webhook ──────────────────────────────────────────────────────

    async def set_webhook(self, url: str, secret_token: str = None,
                          max_connections: int = None) -> dict:
        return await self._send_action("set_webhook", _strip_none({
            "url": url, "secret_token": secret_token,
            "max_connections": max_connections,
        }))

    async def delete_webhook(self) -> dict:
        return await self._send_action("delete_webhook", {})

    async def get_webhook_info(self) -> dict:
        return await self._send_action("get_webhook_info", {})

    # ── Chat photo ───────────────────────────────────────────────────

    async def set_chat_photo(self, chat_id: str, photo) -> dict:
        return await self._send_action("set_chat_photo", {
            "chat_id": chat_id, "photo": _encode_media(photo),
        })

    async def delete_chat_photo(self, chat_id: str) -> dict:
        return await self._send_action("delete_chat_photo", {"chat_id": chat_id})

    # ── Permissions (BotikSDK consent) ───────────────────────────────

    async def check_permissions(self, user_id: str) -> dict:
        """Check if user has granted permissions to this bot."""
        return await self._send_action("check_permissions", {"user_id": user_id})

    async def request_permissions(self, chat_id: str, user_id: str,
                                  scopes: list = None) -> dict:
        """Send a consent request to user."""
        return await self._send_action("request_permissions", {
            "chat_id": chat_id, "user_id": user_id,
            "scopes": scopes or ["basic_profile", "send_messages"],
        })

    # ── File ─────────────────────────────────────────────────────────

    async def get_file(self, file_id: str) -> dict:
        return await self._send_action("get_file", {"file_id": file_id})

    async def download_file(self, file_id: str, destination: str = None) -> dict:
        result = await self._send_action("get_file", {"file_id": file_id})
        if destination and result.get("file_path"):
            import urllib.request
            url = f"{self._client.base_url}/{result['file_path']}"
            urllib.request.urlretrieve(url, destination)
            result["downloaded_to"] = destination
        return result

    async def get_user_profile_photos(self, user_id: str, offset: int = None,
                                      limit: int = None) -> dict:
        return await self._send_action("get_user_profile_photos", _strip_none({
            "user_id": user_id, "offset": offset, "limit": limit,
        }))

    # ── Chat actions (auto-typing helpers) ───────────────────────────

    async def typing(self, chat_id: str) -> dict:
        return await self.send_chat_action(chat_id, "typing")

    async def upload_photo(self, chat_id: str) -> dict:
        return await self.send_chat_action(chat_id, "upload_photo")

    async def upload_video(self, chat_id: str) -> dict:
        return await self.send_chat_action(chat_id, "upload_video")

    async def upload_document(self, chat_id: str) -> dict:
        return await self.send_chat_action(chat_id, "upload_document")

    async def upload_voice(self, chat_id: str) -> dict:
        return await self.send_chat_action(chat_id, "upload_voice")

    # ── Internal ─────────────────────────────────────────────────────

    async def _send_action(self, action: str, data: dict) -> dict:
        """Send an action to the Vontic backend."""
        return await self._client.send_action(action, data)
