import argparse
import asyncio
import base64
import os
import secrets
from dataclasses import dataclass, field
from typing import Optional, Tuple

DEFAULT_LISTEN = "0.0.0.0:9000"
DEFAULT_CHUNK_SIZE = 65536
DEFAULT_MAX_FRAME_SIZE = 4 * 1024 * 1024
HTTP_HEADER_LIMIT = 65536
PROXY_RECEIVER_VERSION = "1.0"


@dataclass(frozen=True)
class ProxyConfig:
    mode: str
    listen_host: str
    listen_port: int
    upstream_host: Optional[str]
    upstream_port: Optional[int]
    channel_peer_host: Optional[str]
    channel_peer_port: Optional[int]
    master_key: Optional[bytes]
    public_key: Optional[str]
    chunk_size: int
    max_frame_size: int
    standalone_mode: str
    enable_tui: bool


@dataclass
class ProxyStats:
    total_connections: int = 0
    active_connections: int = 0
    accepted_connections: int = 0
    rejected_connections: int = 0
    bytes_in: int = 0
    bytes_out: int = 0
    lock: asyncio.Lock = field(default_factory=asyncio.Lock)


def parse_host_port(value: str) -> Tuple[str, int]:
    if ":" not in value:
        return "0.0.0.0", int(value)
    host, port = value.rsplit(":", 1)
    return host.strip() or "0.0.0.0", int(port)


def normalize_key(key: str) -> bytes:
    raw = key.strip()
    try:
        decoded = base64.urlsafe_b64decode(raw.encode())
        if len(decoded) >= 32:
            return decoded[:32]
    except Exception:
        pass
    try:
        decoded = bytes.fromhex(raw)
        if len(decoded) >= 32:
            return decoded[:32]
    except Exception:
        pass
    raw_bytes = raw.encode()
    if len(raw_bytes) >= 32:
        return raw_bytes[:32]
    raise ValueError("Master key must be at least 32 bytes")


def build_config() -> ProxyConfig:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--mode",
        choices=["active", "passive"],
        default=os.getenv("PROXY_RECEIVER_MODE", "passive"),
    )
    parser.add_argument(
        "--listen",
        default=os.getenv("PROXY_RECEIVER_LISTEN", DEFAULT_LISTEN),
    )
    parser.add_argument(
        "--upstream",
        default=os.getenv("PROXY_RECEIVER_UPSTREAM"),
    )
    parser.add_argument(
        "--channel-peer",
        default=os.getenv("PROXY_RECEIVER_CHANNEL_PEER"),
    )
    parser.add_argument(
        "--master-key",
        default=os.getenv("PROXY_RECEIVER_MASTER_KEY"),
    )
    parser.add_argument(
        "--public-key",
        default=os.getenv("PROXY_RECEIVER_PUBLIC_KEY"),
    )
    parser.add_argument(
        "--chunk-size",
        type=int,
        default=int(os.getenv("PROXY_RECEIVER_CHUNK_SIZE", DEFAULT_CHUNK_SIZE)),
    )
    parser.add_argument(
        "--max-frame",
        type=int,
        default=int(
            os.getenv("PROXY_RECEIVER_MAX_FRAME", DEFAULT_MAX_FRAME_SIZE)
        ),
    )
    parser.add_argument(
        "--standalone-mode",
        choices=["echo", "blackhole", "http"],
        default=os.getenv("PROXY_RECEIVER_STANDALONE_MODE", "echo"),
    )
    parser.add_argument(
        "--tui",
        action="store_true",
        default=os.getenv("PROXY_RECEIVER_TUI", "false").lower()
        in ("true", "1", "t"),
    )
    parser.add_argument(
        "--gen-key",
        action="store_true",
        default=False,
    )
    args = parser.parse_args()

    if args.gen_key:
        key = base64.urlsafe_b64encode(secrets.token_bytes(32)).decode()
        print(key)
        raise SystemExit(0)

    listen_host, listen_port = parse_host_port(args.listen)
    upstream_host = None
    upstream_port = None
    if args.upstream:
        upstream_host, upstream_port = parse_host_port(args.upstream)
    master_key = normalize_key(args.master_key) if args.master_key else None
    if args.mode == "active" and not master_key:
        raise SystemExit("master key required for active mode")
    channel_peer_host = None
    channel_peer_port = None
    if args.channel_peer:
        channel_peer_host, channel_peer_port = parse_host_port(
            args.channel_peer)
    if (channel_peer_host or channel_peer_port) and not master_key:
        raise SystemExit("master key required for channel mode")

    return ProxyConfig(
        mode=args.mode,
        listen_host=listen_host,
        listen_port=listen_port,
        upstream_host=upstream_host,
        upstream_port=upstream_port,
        channel_peer_host=channel_peer_host,
        channel_peer_port=channel_peer_port,
        master_key=master_key,
        public_key=args.public_key,
        chunk_size=max(1024, args.chunk_size),
        max_frame_size=max(65536, args.max_frame),
        standalone_mode=args.standalone_mode,
        enable_tui=args.tui,
    )
