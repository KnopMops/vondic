"""BotikSDK v0.5 — WebSocket client for real-time bot communication."""
import json
import time
import logging
import threading
import websocket
import asyncio
from typing import Callable, Optional

logger = logging.getLogger(__name__)


class BotWebSocket:
    """WebSocket client for real-time bot updates."""

    def __init__(self, bot_id, token, base_url="http://localhost:5050",
                 on_update=None, on_connect=None, on_disconnect=None):
        self.bot_id = bot_id
        self.token = token
        self.base_url = base_url
        self.on_update = on_update
        self.on_connect = on_connect
        self.on_disconnect = on_disconnect

        self._ws = None
        self._running = False
        self._thread = None
        self._reconnect_delay = 1
        self._max_reconnect_delay = 30

    def _get_ws_url(self):
        """Get WebSocket URL from backend config."""
        import requests
        try:
            resp = requests.get(
                f"{self.base_url}/api/public/v2/bots/{self.bot_id}/ws/config",
                headers={"Authorization": f"Bot {self.token}"},
                timeout=5,
            )
            if resp.status_code == 200:
                data = resp.json()
                ws_url = data.get("websocket_url", "")
                if ws_url:
                    # Convert ws:// to the correct URL
                    if ws_url.startswith("ws://"):
                        ws_url = ws_url.replace("ws://", "ws://", 1)
                    return ws_url
        except Exception:
            pass
        # Fallback
        ws_base = self.base_url.replace("http://", "ws://").replace("https://", "wss://")
        return f"{ws_base}/socket.io/?bot_id={self.bot_id}&token={self.token}"

    def _on_message(self, ws, message):
        """Handle incoming WebSocket message."""
        try:
            data = json.loads(message)
            msg_type = data.get("type", "")

            if msg_type == "update" and self.on_update:
                self.on_update(data.get("data", {}))
            elif msg_type == "connected":
                logger.info("bot_ws_connected bot_id=%s", self.bot_id)
                self._reconnect_delay = 1
                if self.on_connect:
                    self.on_connect()
            elif msg_type == "error":
                logger.error("bot_ws_error bot_id=%s message=%s", self.bot_id, data.get("message"))
            elif msg_type == "message_sent":
                pass  # Acknowledgment
        except json.JSONDecodeError:
            logger.warning("bot_ws_invalid_json bot_id=%s", self.bot_id)

    def _on_error(self, ws, error):
        """Handle WebSocket error."""
        logger.error("bot_ws_error bot_id=%s error=%s", self.bot_id, error)

    def _on_close(self, ws, close_status_code, close_msg):
        """Handle WebSocket close."""
        logger.info("bot_ws_closed bot_id=%s code=%s", self.bot_id, close_status_code)
        self._running = False
        if self.on_disconnect:
            self.on_disconnect()

    def _on_open(self, ws):
        """Handle WebSocket open."""
        logger.info("bot_ws_opened bot_id=%s", self.bot_id)

    def _run(self):
        """Run WebSocket in background thread."""
        while self._running:
            try:
                ws_url = self._get_ws_url()
                logger.info("bot_ws_connecting bot_id=%s url=%s", self.bot_id, ws_url)

                self._ws = websocket.WebSocketApp(
                    ws_url,
                    on_message=self._on_message,
                    on_error=self._on_error,
                    on_close=self._on_close,
                    on_open=self._on_open,
                )
                self._ws.run_forever(
                    ping_interval=30,
                    ping_timeout=10,
                    reconnect=0,
                )
            except Exception as e:
                logger.error("bot_ws_exception bot_id=%s error=%s", self.bot_id, e)

            if self._running:
                logger.info("bot_ws_reconnecting bot_id=%s delay=%ds", self.bot_id, self._reconnect_delay)
                time.sleep(self._reconnect_delay)
                self._reconnect_delay = min(self._reconnect_delay * 2, self._max_reconnect_delay)

    def start(self):
        """Start WebSocket in background thread."""
        if self._running:
            return
        self._running = True
        self._thread = threading.Thread(target=self._run, daemon=True)
        self._thread.start()
        logger.info("bot_ws_thread_started bot_id=%s", self.bot_id)

    def stop(self):
        """Stop WebSocket."""
        self._running = False
        if self._ws:
            self._ws.close()

    def send(self, action, data=None):
        """Send a message via WebSocket."""
        if not self._ws:
            raise ConnectionError("WebSocket not connected")
        payload = {"action": action}
        if data:
            payload.update(data)
        self._ws.send(json.dumps(payload))

    def send_message(self, chat_id, text, reply_markup=None, game=None):
        """Send a message via WebSocket."""
        data = {"chat_id": chat_id, "text": text}
        if reply_markup:
            data["reply_markup"] = reply_markup
        if game:
            data["game"] = game
        self.send("send_message", data)

    def answer_callback(self, callback_id, text=None):
        """Answer a callback query via WebSocket."""
        self.send("answer_callback", {"callback_id": callback_id, "text": text})
