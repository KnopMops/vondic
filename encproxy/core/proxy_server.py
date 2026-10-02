import asyncio
import hashlib
import json
import logging
import time
import uuid
from typing import Optional, Dict, Any

try:
    from aiohttp import web, ClientSession, ClientTimeout
    HAS_AIOHTTP = True
except ImportError:
    HAS_AIOHTTP = False

from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
import urllib.request
import urllib.error

from .crypto_engine import CryptoEngine
from .packet_engine import PacketEngine, PacketItem
from .unwrapped_module import UnwrappedModule

logger = logging.getLogger(__name__)


class StandardProxyHandler(BaseHTTPRequestHandler):
    """Fallback HTTP proxy handler using standard library."""

    server_ref: Any = None

    def log_message(self, format, *args):
        pass  # Quiet standard logging

    def do_GET(self):
        self._proxy_request("GET")

    def do_POST(self):
        self._proxy_request("POST")

    def do_PUT(self):
        self._proxy_request("PUT")

    def do_DELETE(self):
        self._proxy_request("DELETE")

    def do_PATCH(self):
        self._proxy_request("PATCH")

    def do_OPTIONS(self):
        self._proxy_request("OPTIONS")

    def _proxy_request(self, method: str):
        server = self.server_ref
        start_time = time.time()
        target_url = f"{server.target_backend}{self.path}"

        in_headers = {}
        for k, v in self.headers.items():
            in_headers[k] = v

        for h in ("Host", "Content-Length", "Transfer-Encoding", "Connection"):
            in_headers.pop(h, None)

        # 1. Apply Header Rules
        out_headers, was_headers_modified = server.packet_engine.apply_header_rules(target_url, in_headers)

        # 2. Read request body
        content_length = int(self.headers.get("Content-Length", 0))
        req_body_bytes = self.rfile.read(content_length) if content_length > 0 else b""
        req_body_str = req_body_bytes.decode("utf-8", errors="replace") if req_body_bytes else ""
        was_body_modified = False
        is_encrypted = False

        # 3. Intercept outbound messages for EncProxy wrapping
        if "/api/v1/messages" in target_url and method == "POST" and req_body_str:
            try:
                payload = json.loads(req_body_str)
                target_user_id = payload.get("target_user_id")
                content = payload.get("content", "")
                dh_pub = server.crypto_engine.get_public_keys()["dh_public_key"]

                # Always signal EncProxy protection support to peer
                out_headers["X-EncProxy-Protected"] = "1"
                out_headers["X-EncProxy-DH-Pubkey"] = dh_pub

                if target_user_id and server.unwrapped_module.is_peer_encrypted(target_user_id):
                    wrapped_content, wrapped = server.unwrapped_module.wrap_outbound_message(target_user_id, content)
                    if wrapped:
                        payload["content"] = wrapped
                        payload["is_encproxy"] = True
                        is_encrypted = True
                        was_body_modified = True

                        metadata = {
                            "sender_id": payload.get("sender_id", ""),
                            "target_user_id": target_user_id,
                            "timestamp": int(time.time()),
                            "content_hash": hashlib.sha256(wrapped_content.encode("utf-8")).hexdigest(),
                        }
                        sig = server.crypto_engine.sign_metadata(metadata)
                        out_headers["X-EncProxy-Signature"] = sig
                        out_headers["X-EncProxy-Sender-Pubkey"] = server.crypto_engine.get_public_keys()["signing_public_key"]

                        req_body_str = json.dumps(payload)
                        req_body_bytes = req_body_str.encode("utf-8")
                else:
                    # If target is pending or not yet approved, mark outbound message with encproxy hint
                    if target_user_id and not content.startswith("encproxy:handshake:"):
                        if not isinstance(payload.get("extra"), dict):
                            payload["extra"] = {}
                        payload["extra"]["encproxy"] = True
                        payload["extra"]["encproxy_dh_pub"] = dh_pub
                        was_body_modified = True
                        req_body_str = json.dumps(payload)
                        req_body_bytes = req_body_str.encode("utf-8")
            except Exception as e:
                logger.error(f"Error wrapping outbound message: {e}")

        # 4. Forward to upstream
        status_code = 502
        resp_headers = {}
        resp_body_bytes = b""

        try:
            req = urllib.request.Request(
                url=target_url,
                data=req_body_bytes if req_body_bytes else None,
                headers=out_headers,
                method=method,
            )
            with urllib.request.urlopen(req, timeout=30) as upstream_resp:
                status_code = upstream_resp.status
                resp_headers = dict(upstream_resp.headers)
                resp_body_bytes = upstream_resp.read()
        except urllib.error.HTTPError as e:
            status_code = e.code
            resp_headers = dict(e.headers)
            resp_body_bytes = e.read()
        except Exception as e:
            logger.error(f"Upstream error for {target_url}: {e}")
            resp_body_bytes = json.dumps({"error": f"EncProxy Upstream Error: {str(e)}"}).encode("utf-8")
            status_code = 502

        # 5. Inbound Unwrapping & Auto-Handshake Interception
        resp_body_str = resp_body_bytes.decode("utf-8", errors="replace")
        if "/api/v1/dm" in target_url or "/api/v1/messages" in target_url:
            try:
                data = json.loads(resp_body_str)
                messages_list = []
                if isinstance(data, dict):
                    if "messages" in data and isinstance(data["messages"], list):
                        messages_list = data["messages"]
                    elif "items" in data and isinstance(data["items"], list):
                        messages_list = data["items"]
                elif isinstance(data, list):
                    messages_list = data

                for msg in messages_list:
                    sender_id = msg.get("sender_id")
                    sender_name = msg.get("sender_username") or msg.get("author_name") or ""
                    raw_content = msg.get("content", "")

                    # Check for handshake approval from peer
                    if "encproxy:handshake:approve:" in raw_content or "encproxy_handshake:approve:" in raw_content:
                        parts = raw_content.split("approve:", 1)
                        if len(parts) > 1:
                            dh_key = parts[1].strip()
                            server.unwrapped_module.auto_approve_peer(
                                user_id=sender_id,
                                username=sender_name,
                                dh_public_key=dh_key,
                            )
                            msg["content"] = "[Собеседник одобрил стороннее шифрование EncProxy. Ключ успешно перехвачен, шифрование активировано!]"
                            msg["is_encproxy_unwrapped"] = True
                            is_encrypted = True
                            continue

                    if sender_id and raw_content:
                        unwrapped, was_unwrapped = server.unwrapped_module.unwrap_inbound_message(sender_id, raw_content)
                        if was_unwrapped:
                            msg["content"] = unwrapped
                            msg["is_encproxy_unwrapped"] = True
                            is_encrypted = True

                resp_body_str = json.dumps(data)
                resp_body_bytes = resp_body_str.encode("utf-8")
            except Exception as e:
                logger.error(f"Inbound unwrap error: {e}")


        latency_ms = (time.time() - start_time) * 1000

        # 6. Record in Packet Inspector
        packet_item = PacketItem(
            id=uuid.uuid4().hex[:12],
            timestamp=start_time,
            method=method,
            url=target_url,
            status_code=status_code,
            request_headers=out_headers,
            response_headers=resp_headers,
            request_body=req_body_str[:4096] if req_body_str else None,
            response_body=resp_body_str[:4096] if resp_body_str else None,
            content_type=resp_headers.get("Content-Type", "text/plain"),
            latency_ms=round(latency_ms, 2),
            was_modified=was_headers_modified or was_body_modified,
            is_encrypted=is_encrypted,
        )
        server.packet_engine.record_packet(packet_item)

        # 7. Write response to client
        self.send_response(status_code)
        for k, v in resp_headers.items():
            if k.lower() not in ("transfer-encoding", "content-encoding", "content-length"):
                self.send_header(k, v)
        self.send_header("Content-Length", str(len(resp_body_bytes)))
        self.end_headers()
        self.wfile.write(resp_body_bytes)


class EncProxyServer:
    """
    Local MitM & Relay Proxy Server.
    Supports aiohttp or built-in ThreadingHTTPServer.
    """

    def __init__(
        self,
        host: str = "127.0.0.1",
        port: int = 8888,
        target_backend: str = "https://vondic.ru",
        crypto_engine: Optional[CryptoEngine] = None,
        packet_engine: Optional[PacketEngine] = None,
        unwrapped_module: Optional[UnwrappedModule] = None,
    ):
        self.host = host
        self.port = port
        self.target_backend = target_backend.rstrip("/")
        self.crypto_engine = crypto_engine or CryptoEngine()
        self.packet_engine = packet_engine or PacketEngine()
        self.unwrapped_module = unwrapped_module or UnwrappedModule(self.crypto_engine)

        self.httpd: Optional[ThreadingHTTPServer] = None
        self.is_running = False

    async def start(self):
        if self.is_running:
            return

        StandardProxyHandler.server_ref = self
        self.httpd = ThreadingHTTPServer((self.host, self.port), StandardProxyHandler)
        self.is_running = True
        logger.info(f"EncProxy Server listening on http://{self.host}:{self.port} -> {self.target_backend}")

        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, self.httpd.serve_forever)

    async def stop(self):
        if not self.is_running:
            return
        if self.httpd:
            self.httpd.shutdown()
            self.httpd.server_close()
        self.is_running = False
        logger.info("EncProxy Server stopped.")
