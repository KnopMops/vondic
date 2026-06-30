"""
EncProxy relay — routes encrypted messages between clients.

The server NEVER sees plaintext. It only:
  1. Authenticates users (verifies JWT access tokens via backend API)
  2. Maps socket_id -> user_id
  3. Relays opaque encrypted blobs to the correct recipient(s)
"""

import logging
import time
from collections import defaultdict

import requests
from flask_socketio import SocketIO

logger = logging.getLogger("encproxy.relay")


class EncProxyRelay:
    """Thin relay that authenticates users and forwards encrypted payloads."""

    def __init__(self, socketio: SocketIO, backend_url: str):
        self.socketio = socketio
        self.backend_url = backend_url.rstrip("/")

        # sid -> user_id
        self._sid_to_user: dict[str, str] = {}
        # user_id -> set of sids
        self._user_to_sids: dict[str, set[str]] = defaultdict(set)
        # Rate-limit: sliding window per IP
        self._connect_windows: dict[str, list[float]] = defaultdict(list)
        self._RATE_WINDOW = 60
        self._RATE_LIMIT = 30

    def bind_events(self):
        self.socketio.on("connect")(self._on_connect)
        self.socketio.on("disconnect")(self._on_disconnect)
        self.socketio.on("encproxy_auth")(self._on_auth)
        self.socketio.on("encproxy_send")(self._on_send)
        self.socketio.on("encproxy_broadcast")(self._on_broadcast)
        self.socketio.on("encproxy_ping")(self._on_ping)
        self.socketio.on("encproxy_key_exchange")(self._on_key_exchange)
        self.socketio.on("encproxy_group_key_exchange")(self._on_group_key_exchange)

    def _verify_token(self, access_token: str) -> dict | None:
        """Verify access token against the backend API."""
        try:
            resp = requests.get(
                f"{self.backend_url}/api/v1/auth/me",
                headers={"Authorization": f"Bearer {access_token}"},
                timeout=5,
            )
            if resp.status_code == 200:
                data = resp.json()
                user = data.get("user") or data
                if user.get("id"):
                    return user
        except Exception as e:
            logger.warning(f"Token verification failed: {e}")
        return None

    def _on_connect(self, auth=None):
        """Rate-limit connections per IP."""
        from flask import request
        ip = request.remote_addr or "unknown"
        now = time.time()
        window = self._connect_windows[ip]
        window[:] = [t for t in window if now - t < self._RATE_WINDOW]
        if len(window) >= self._RATE_LIMIT:
            logger.warning(f"Rate limit exceeded for {ip}")
            return False
        window.append(now)
        return True

    def _on_disconnect(self):
        from flask import request
        sid = request.sid
        user_id = self._sid_to_user.pop(sid, None)
        if user_id:
            self._user_to_sids[user_id].discard(sid)
            if not self._user_to_sids[user_id]:
                self._user_to_sids.pop(user_id, None)
            logger.info(f"[EncProxy] {user_id} disconnected (sid={sid})")

    def _on_auth(self, data):
        from flask import request
        sid = request.sid
        access_token = (data or {}).get("access_token", "")
        if not access_token:
            self.socketio.emit("encproxy_auth_error", {"error": "No token"}, room=sid)
            return

        user = self._verify_token(access_token)
        if not user:
            self.socketio.emit("encproxy_auth_error", {"error": "Invalid token"}, room=sid)
            return

        user_id = str(user["id"])
        self._sid_to_user[sid] = user_id
        self._user_to_sids[user_id].add(sid)

        self.socketio.emit("encproxy_auth_ok", {
            "user_id": user_id,
            "socket_id": sid,
        }, room=sid)
        logger.info(f"[EncProxy] {user_id} authenticated (sid={sid})")

    def _on_send(self, data):
        """Relay an encrypted message to the target user."""
        from flask import request
        sid = request.sid
        sender_id = self._sid_to_user.get(sid)
        if not sender_id:
            self.socketio.emit("encproxy_error", {"error": "Not authenticated"}, room=sid)
            return

        target_user_id = str((data or {}).get("target_user_id", ""))
        if not target_user_id:
            self.socketio.emit("encproxy_error", {"error": "No target"}, room=sid)
            return

        payload = {
            "from_user_id": sender_id,
            "encrypted_content": data.get("encrypted_content", ""),
            "encrypted_attachments": data.get("encrypted_attachments", ""),
            "message_type": data.get("message_type", "text"),
            "timestamp": data.get("timestamp", int(time.time() * 1000)),
            "nonce": data.get("nonce", ""),
            "reply_to": data.get("reply_to"),
            "extra": data.get("extra"),
        }

        target_sids = self._user_to_sids.get(target_user_id, set())
        if target_sids:
            for tsid in target_sids:
                self.socketio.emit("encproxy_receive", payload, room=tsid)
            self.socketio.emit("encproxy_sent", {
                "status": "delivered",
                "target_user_id": target_user_id,
            }, room=sid)
        else:
            self.socketio.emit("encproxy_sent", {
                "status": "queued",
                "target_user_id": target_user_id,
            }, room=sid)

    def _on_broadcast(self, data):
        """Relay an encrypted message to multiple target users (for groups/channels)."""
        from flask import request
        sid = request.sid
        sender_id = self._sid_to_user.get(sid)
        if not sender_id:
            self.socketio.emit("encproxy_error", {"error": "Not authenticated"}, room=sid)
            return

        target_user_ids = (data or {}).get("target_user_ids", [])
        if not target_user_ids:
            self.socketio.emit("encproxy_error", {"error": "No targets"}, room=sid)
            return

        payload = {
            "from_user_id": sender_id,
            "encrypted_content": data.get("encrypted_content", ""),
            "encrypted_attachments": data.get("encrypted_attachments", ""),
            "message_type": data.get("message_type", "text"),
            "timestamp": data.get("timestamp", int(time.time() * 1000)),
            "nonce": data.get("nonce", ""),
        }

        delivered = 0
        for tid in target_user_ids:
            tid_str = str(tid)
            target_sids = self._user_to_sids.get(tid_str, set())
            for tsid in target_sids:
                self.socketio.emit("encproxy_receive", payload, room=tsid)
                delivered += 1

        self.socketio.emit("encproxy_sent", {
            "status": "delivered" if delivered > 0 else "queued",
            "delivered_count": delivered,
        }, room=sid)

    def _on_key_exchange(self, data):
        """Forward an E2E public key to another user through the proxy."""
        from flask import request
        sid = request.sid
        sender_id = self._sid_to_user.get(sid)
        if not sender_id:
            return

        target_user_id = str((data or {}).get("target_user_id", ""))
        if not target_user_id:
            return

        payload = {
            "from_user_id": sender_id,
            "public_key": data.get("public_key", ""),
            "key_id": data.get("key_id", ""),
            "type": data.get("type", "offer"),
        }

        target_sids = self._user_to_sids.get(target_user_id, set())
        for tsid in target_sids:
            self.socketio.emit("encproxy_key_exchange", payload, room=tsid)

    def _on_group_key_exchange(self, data):
        """Forward an E2E group key to multiple users."""
        from flask import request
        sid = request.sid
        sender_id = self._sid_to_user.get(sid)
        if not sender_id:
            return

        target_user_ids = (data or {}).get("target_user_ids", [])
        payload = {
            "from_user_id": sender_id,
            "encrypted_group_key": data.get("encrypted_group_key", ""),
            "key_id": data.get("key_id", ""),
            "group_id": data.get("group_id", ""),
        }

        for tid in target_user_ids:
            tid_str = str(tid)
            target_sids = self._user_to_sids.get(tid_str, set())
            for tsid in target_sids:
                self.socketio.emit("encproxy_group_key_exchange", payload, room=tsid)

    def _on_ping(self, data):
        """Respond to keepalive pings."""
        from flask import request
        sid = request.sid
        self.socketio.emit("encproxy_pong", {"ts": int(time.time() * 1000)}, room=sid)

    def get_online_user_ids(self) -> list[str]:
        return list(self._user_to_sids.keys())

    def get_user_sid_count(self, user_id: str) -> int:
        return len(self._user_to_sids.get(user_id, set()))
