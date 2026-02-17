import argparse
import asyncio
import base64
import logging
import os
import re
import secrets
import struct
import sys
import time
from dataclasses import dataclass, field
from typing import Optional, Tuple
from urllib.parse import urlsplit

from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.hkdf import HKDF

MAGIC = b"PXE1"
VERSION = 1
HANDSHAKE_NONCE_SIZE = 32
FRAME_NONCE_SIZE = 12
DEFAULT_LISTEN = "0.0.0.0:9000"
DEFAULT_CHUNK_SIZE = 65536
DEFAULT_MAX_FRAME_SIZE = 4 * 1024 * 1024
HTTP_HEADER_LIMIT = 65536


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


def derive_session_key(master_key: bytes, client_nonce: bytes, server_nonce: bytes) -> bytes:
    hkdf = HKDF(
        algorithm=hashes.SHA256(),
        length=32,
        salt=client_nonce + server_nonce,
        info=b"proxy_receiver_session",
    )
    return hkdf.derive(master_key)


async def relay_stream(
    reader: asyncio.StreamReader,
    writer: asyncio.StreamWriter,
    chunk_size: int,
    stats: ProxyStats,
    direction: str,
) -> None:
    while True:
        data = await reader.read(chunk_size)
        if not data:
            break
        async with stats.lock:
            if direction == "in":
                stats.bytes_in += len(data)
            else:
                stats.bytes_out += len(data)
        writer.write(data)
        await writer.drain()


async def relay_echo(
    reader: asyncio.StreamReader,
    writer: asyncio.StreamWriter,
    chunk_size: int,
    stats: ProxyStats,
) -> None:
    while True:
        data = await reader.read(chunk_size)
        if not data:
            break
        async with stats.lock:
            stats.bytes_in += len(data)
            stats.bytes_out += len(data)
        writer.write(data)
        await writer.drain()


async def read_frame(reader: asyncio.StreamReader, max_frame_size: int) -> Optional[bytes]:
    header = await reader.readexactly(4)
    frame_len = struct.unpack(">I", header)[0]
    if frame_len == 0:
        return None
    if frame_len > max_frame_size:
        raise ValueError("Frame too large")
    payload = await reader.readexactly(frame_len)
    return payload


async def read_http_request(
    reader: asyncio.StreamReader,
    limit: int,
) -> Tuple[bytes, bytes]:
    data = b""
    while b"\r\n\r\n" not in data:
        chunk = await reader.read(4096)
        if not chunk:
            break
        data += chunk
        if len(data) > limit:
            raise ValueError("Header too large")
    if b"\r\n\r\n" not in data:
        return data, b""
    header_block, rest = data.split(b"\r\n\r\n", 1)
    return header_block, rest


async def write_frame(writer: asyncio.StreamWriter, payload: bytes) -> None:
    writer.write(struct.pack(">I", len(payload)) + payload)
    await writer.drain()


async def encrypt_and_send(
    writer: asyncio.StreamWriter,
    aesgcm: AESGCM,
    plaintext: bytes,
    stats: ProxyStats,
) -> None:
    nonce = secrets.token_bytes(FRAME_NONCE_SIZE)
    ciphertext = aesgcm.encrypt(nonce, plaintext, None)
    async with stats.lock:
        stats.bytes_out += len(plaintext)
    await write_frame(writer, nonce + ciphertext)


async def recv_and_decrypt(
    reader: asyncio.StreamReader,
    aesgcm: AESGCM,
    max_frame_size: int,
    stats: ProxyStats,
) -> Optional[bytes]:
    payload = await read_frame(reader, max_frame_size)
    if payload is None:
        return None
    if len(payload) < FRAME_NONCE_SIZE + 16:
        raise ValueError("Invalid encrypted frame")
    nonce = payload[:FRAME_NONCE_SIZE]
    ciphertext = payload[FRAME_NONCE_SIZE:]
    plaintext = aesgcm.decrypt(nonce, ciphertext, None)
    async with stats.lock:
        stats.bytes_in += len(plaintext)
    return plaintext


async def read_api_key(reader: asyncio.StreamReader, max_frame_size: int) -> Optional[str]:
    payload = await read_frame(reader, max_frame_size)
    if payload is None:
        return None
    return payload.decode(errors="ignore")


async def send_api_key(
    writer: asyncio.StreamWriter,
    api_key: Optional[str],
) -> None:
    if not api_key:
        return
    await write_frame(writer, api_key.encode())


def parse_http_headers(header_block: bytes) -> Tuple[str, list[Tuple[str, str]]]:
    text = header_block.decode("iso-8859-1")
    lines = text.split("\r\n")
    request_line = lines[0] if lines else ""
    headers: list[Tuple[str, str]] = []
    for line in lines[1:]:
        if not line:
            continue
        if ":" not in line:
            continue
        name, value = line.split(":", 1)
        headers.append((name.strip(), value.lstrip()))
    return request_line, headers


def headers_to_dict(headers: list[Tuple[str, str]]) -> dict[str, str]:
    return {name.lower(): value for name, value in headers}


def filter_headers(
    headers: list[Tuple[str, str]],
    drop: set[str],
) -> list[Tuple[str, str]]:
    filtered: list[Tuple[str, str]] = []
    for name, value in headers:
        if name.lower() in drop:
            continue
        filtered.append((name, value))
    return filtered


def extract_api_key(headers: list[Tuple[str, str]]) -> Optional[str]:
    for name, value in headers:
        if name.lower() == "x-proxy-api-key":
            return value.strip()
        if name.lower() == "proxy-authorization":
            parts = value.split()
            if len(parts) == 2 and parts[0].lower() == "apikey":
                return parts[1].strip()
    return None


async def send_http_response(
    writer: asyncio.StreamWriter,
    status: int,
    reason: str,
    body: bytes = b"",
) -> None:
    headers = [
        f"HTTP/1.1 {status} {reason}",
        f"Content-Length: {len(body)}",
        "Connection: close",
        "",
        "",
    ]
    writer.write("\r\n".join(headers).encode("iso-8859-1") + body)
    await writer.drain()


async def handle_http_proxy(
    reader: asyncio.StreamReader,
    writer: asyncio.StreamWriter,
    config: ProxyConfig,
    stats: ProxyStats,
) -> None:
    header_block, rest = await read_http_request(reader, HTTP_HEADER_LIMIT)
    request_line, headers = parse_http_headers(header_block)
    if not request_line:
        return
    if config.public_key:
        supplied = extract_api_key(headers)
        if not supplied or supplied != config.public_key:
            async with stats.lock:
                stats.rejected_connections += 1
            await send_http_response(
                writer,
                407,
                "Proxy Authentication Required",
                b"Proxy API key required",
            )
            return
        async with stats.lock:
            stats.accepted_connections += 1

    parts = request_line.split(" ", 2)
    if len(parts) != 3:
        await send_http_response(writer, 400, "Bad Request", b"Invalid request")
        return
    method, target, version = parts
    if method.upper() == "CONNECT":
        if config.channel_peer_host and config.channel_peer_port:
            await send_http_response(
                writer, 403, "Forbidden", b"CONNECT not supported in channel mode"
            )
            return
        if ":" in target:
            host, port_text = target.rsplit(":", 1)
            port = int(port_text)
        else:
            host, port = target, 443
        upstream_reader, upstream_writer = await asyncio.open_connection(host, port)
        writer.write(b"HTTP/1.1 200 Connection Established\r\n\r\n")
        await writer.drain()
        if rest:
            upstream_writer.write(rest)
            await upstream_writer.drain()
        await asyncio.gather(
            relay_stream(reader, upstream_writer,
                         config.chunk_size, stats, "in"),
            relay_stream(upstream_reader, writer,
                         config.chunk_size, stats, "out"),
        )
        return

    url = urlsplit(target)
    host = url.hostname
    port = url.port
    path = url.path or "/"
    if url.query:
        path = f"{path}?{url.query}"
    header_map = headers_to_dict(headers)
    if not host:
        host_header = header_map.get("host")
        if not host_header:
            await send_http_response(writer, 400, "Bad Request", b"Missing host")
            return
        if ":" in host_header:
            host, port_text = host_header.rsplit(":", 1)
            port = int(port_text)
        else:
            host, port = host_header, 80
    if not port:
        port = 443 if url.scheme == "https" else 80

    channel_reader = None
    channel_writer = None
    channel_cipher = None
    if config.channel_peer_host and config.channel_peer_port:
        channel_reader, channel_writer, channel_cipher = await open_channel_connection(
            config, stats
        )
        upstream_reader, upstream_writer = channel_reader, channel_writer
    else:
        upstream_reader, upstream_writer = await asyncio.open_connection(host, port)
    drop_headers = {"proxy-authorization",
                    "proxy-connection", "x-proxy-api-key"}
    filtered = filter_headers(headers, drop_headers)
    if "host" not in header_map:
        filtered.append(("Host", host))
    request_head = f"{method} {path} {version}\r\n"
    header_lines = "".join(
        [f"{name}: {value}\r\n" for name, value in filtered])
    payload = (request_head + header_lines +
               "\r\n").encode("iso-8859-1") + rest
    if channel_cipher and channel_writer:
        if payload:
            await encrypt_and_send(channel_writer, channel_cipher, payload, stats)
        await asyncio.gather(
            relay_plain_to_channel(
                reader, channel_writer, channel_cipher, config.chunk_size, stats
            ),
            relay_channel_to_plain(
                channel_reader, writer, channel_cipher, config.max_frame_size, stats
            ),
        )
    else:
        upstream_writer.write(payload)
        await upstream_writer.drain()
        await asyncio.gather(
            relay_stream(reader, upstream_writer,
                         config.chunk_size, stats, "in"),
            relay_stream(upstream_reader, writer,
                         config.chunk_size, stats, "out"),
        )


async def perform_handshake(
    reader: asyncio.StreamReader,
    writer: asyncio.StreamWriter,
    master_key: bytes,
) -> AESGCM:
    header = await reader.readexactly(4 + 1 + HANDSHAKE_NONCE_SIZE)
    if header[:4] != MAGIC:
        raise ValueError("Invalid handshake magic")
    version = header[4]
    if version != VERSION:
        raise ValueError("Unsupported protocol version")
    client_nonce = header[5:]
    server_nonce = secrets.token_bytes(HANDSHAKE_NONCE_SIZE)
    writer.write(MAGIC + bytes([VERSION]) + server_nonce)
    await writer.drain()
    session_key = derive_session_key(master_key, client_nonce, server_nonce)
    return AESGCM(session_key)


async def perform_client_handshake(
    reader: asyncio.StreamReader,
    writer: asyncio.StreamWriter,
    master_key: bytes,
) -> AESGCM:
    client_nonce = secrets.token_bytes(HANDSHAKE_NONCE_SIZE)
    writer.write(MAGIC + bytes([VERSION]) + client_nonce)
    await writer.drain()
    header = await reader.readexactly(4 + 1 + HANDSHAKE_NONCE_SIZE)
    if header[:4] != MAGIC:
        raise ValueError("Invalid handshake magic")
    version = header[4]
    if version != VERSION:
        raise ValueError("Unsupported protocol version")
    server_nonce = header[5:]
    session_key = derive_session_key(master_key, client_nonce, server_nonce)
    return AESGCM(session_key)


async def open_channel_connection(
    config: ProxyConfig,
    stats: ProxyStats,
) -> Tuple[asyncio.StreamReader, asyncio.StreamWriter, AESGCM]:
    reader, writer = await asyncio.open_connection(
        config.channel_peer_host, config.channel_peer_port
    )
    await send_api_key(writer, config.public_key)
    aesgcm = await perform_client_handshake(reader, writer, config.master_key or b"")
    return reader, writer, aesgcm


async def relay_plain_to_channel(
    reader: asyncio.StreamReader,
    writer: asyncio.StreamWriter,
    aesgcm: AESGCM,
    chunk_size: int,
    stats: ProxyStats,
) -> None:
    while True:
        data = await reader.read(chunk_size)
        if not data:
            break
        await encrypt_and_send(writer, aesgcm, data, stats)


async def relay_channel_to_plain(
    reader: asyncio.StreamReader,
    writer: asyncio.StreamWriter,
    aesgcm: AESGCM,
    max_frame_size: int,
    stats: ProxyStats,
) -> None:
    while True:
        data = await recv_and_decrypt(reader, aesgcm, max_frame_size, stats)
        if data is None:
            break
        writer.write(data)
        await writer.drain()


async def handle_active_connection(
    reader: asyncio.StreamReader,
    writer: asyncio.StreamWriter,
    config: ProxyConfig,
    stats: ProxyStats,
) -> None:
    if config.public_key:
        supplied = await read_api_key(reader, config.max_frame_size)
        if not supplied or supplied != config.public_key:
            async with stats.lock:
                stats.rejected_connections += 1
            raise ValueError("Unauthorized")
        async with stats.lock:
            stats.accepted_connections += 1
    aesgcm = await perform_handshake(reader, writer, config.master_key or b"")
    if config.upstream_host and config.upstream_port:
        upstream_reader, upstream_writer = await asyncio.open_connection(
            config.upstream_host, config.upstream_port
        )

        async def client_to_upstream():
            try:
                while True:
                    plaintext = await recv_and_decrypt(
                        reader, aesgcm, config.max_frame_size, stats
                    )
                    if plaintext is None:
                        break
                    upstream_writer.write(plaintext)
                    await upstream_writer.drain()
            finally:
                upstream_writer.close()

        async def upstream_to_client():
            try:
                while True:
                    chunk = await upstream_reader.read(config.chunk_size)
                    if not chunk:
                        break
                    await encrypt_and_send(writer, aesgcm, chunk, stats)
            finally:
                writer.close()

        await asyncio.gather(client_to_upstream(), upstream_to_client())
        return

    while True:
        plaintext = await recv_and_decrypt(reader, aesgcm, config.max_frame_size, stats)
        if plaintext is None:
            break
        if config.standalone_mode == "echo":
            await encrypt_and_send(writer, aesgcm, plaintext, stats)


async def handle_passive_connection(
    reader: asyncio.StreamReader,
    writer: asyncio.StreamWriter,
    config: ProxyConfig,
    stats: ProxyStats,
) -> None:
    if config.public_key and config.standalone_mode != "http":
        supplied = await read_api_key(reader, config.max_frame_size)
        if not supplied or supplied != config.public_key:
            async with stats.lock:
                stats.rejected_connections += 1
            raise ValueError("Unauthorized")
        async with stats.lock:
            stats.accepted_connections += 1
    if config.upstream_host and config.upstream_port:
        upstream_reader, upstream_writer = await asyncio.open_connection(
            config.upstream_host, config.upstream_port
        )
        await asyncio.gather(
            relay_stream(reader, upstream_writer,
                         config.chunk_size, stats, "in"),
            relay_stream(upstream_reader, writer,
                         config.chunk_size, stats, "out"),
        )
        return

    if config.channel_peer_host and config.channel_peer_port:
        channel_reader, channel_writer = await asyncio.open_connection(
            config.channel_peer_host, config.channel_peer_port
        )
        await send_api_key(channel_writer, config.public_key)
        aesgcm = await perform_client_handshake(
            channel_reader, channel_writer, config.master_key or b""
        )
        await asyncio.gather(
            relay_plain_to_channel(
                reader, channel_writer, aesgcm, config.chunk_size, stats
            ),
            relay_channel_to_plain(
                channel_reader, writer, aesgcm, config.max_frame_size, stats
            ),
        )
        return

    if config.standalone_mode == "http":
        await handle_http_proxy(reader, writer, config, stats)
        return
    if config.standalone_mode == "echo":
        await relay_echo(reader, writer, config.chunk_size, stats)
        return

    while True:
        data = await reader.read(config.chunk_size)
        if not data:
            break
        async with stats.lock:
            stats.bytes_in += len(data)


async def handle_client(
    reader: asyncio.StreamReader,
    writer: asyncio.StreamWriter,
    config: ProxyConfig,
    stats: ProxyStats,
) -> None:
    try:
        async with stats.lock:
            stats.total_connections += 1
            stats.active_connections += 1
        if config.mode == "active":
            await handle_active_connection(reader, writer, config, stats)
        else:
            await handle_passive_connection(reader, writer, config, stats)
    except asyncio.IncompleteReadError:
        pass
    except Exception as exc:
        logging.getLogger("proxy_receiver").warning(
            "Connection error: %s", exc)
    finally:
        try:
            async with stats.lock:
                stats.active_connections = max(0, stats.active_connections - 1)
            writer.close()
            await writer.wait_closed()
        except Exception:
            pass


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
        default=int(os.getenv("PROXY_RECEIVER_MAX_FRAME",
                    DEFAULT_MAX_FRAME_SIZE)),
    )
    parser.add_argument(
        "--standalone-mode",
        choices=["echo", "blackhole", "http"],
        default=os.getenv("PROXY_RECEIVER_STANDALONE_MODE", "echo"),
    )
    parser.add_argument(
        "--tui",
        action="store_true",
        default=os.getenv("PROXY_RECEIVER_TUI",
                          "false").lower() in ("true", "1", "t"),
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


def format_bytes(value: int) -> str:
    units = ["B", "KB", "MB", "GB", "TB"]
    size = float(value)
    for unit in units:
        if size < 1024 or unit == units[-1]:
            return f"{size:.2f} {unit}"
        size /= 1024
    return f"{size:.2f} TB"


def color(text: str, code: str) -> str:
    return f"\033[{code}m{text}\033[0m"


def strip_ansi(text: str) -> str:
    return re.sub(r"\x1b\[[0-9;]*m", "", text)


def draw_box(lines: list[str], width: int) -> str:
    top = "┌" + "─" * (width - 2) + "┐"
    bottom = "└" + "─" * (width - 2) + "┘"
    body = []
    for line in lines:
        visible = strip_ansi(line)
        padding = width - 2 - len(visible)
        if padding < 0:
            trimmed = visible[: width - 4] + "…"
            line = trimmed
            padding = width - 2 - len(trimmed)
        body.append("│" + line + " " * padding + "│")
    return "\n".join([top] + body + [bottom])


async def tui_loop(config: ProxyConfig, stats: ProxyStats) -> None:
    last_time = time.time()
    last_in = 0
    last_out = 0
    while True:
        await asyncio.sleep(1)
        now = time.time()
        async with stats.lock:
            total = stats.total_connections
            active = stats.active_connections
            accepted = stats.accepted_connections
            rejected = stats.rejected_connections
            bytes_in = stats.bytes_in
            bytes_out = stats.bytes_out
        dt = max(0.001, now - last_time)
        rate_in = (bytes_in - last_in) / dt
        rate_out = (bytes_out - last_out) / dt
        last_time = now
        last_in = bytes_in
        last_out = bytes_out
        upstream = (
            f"{config.upstream_host}:{config.upstream_port}"
            if config.upstream_host and config.upstream_port
            else "none"
        )
        channel_peer = (
            f"{config.channel_peer_host}:{config.channel_peer_port}"
            if config.channel_peer_host and config.channel_peer_port
            else "none"
        )
        header = color("Proxy Receiver", "1;36")
        stats_lines = [
            f"{color('mode', '1;34')}: {color(config.mode, '1;33')}",
            f"{color('listen', '1;34')}: {config.listen_host}:{config.listen_port}",
            f"{color('upstream', '1;34')}: {color(upstream, '0;37')}",
            f"{color('channel', '1;34')}: {color(channel_peer, '0;37')}",
            f"{color('standalone', '1;34')}: {config.standalone_mode}",
        ]
        conn_line = (
            f"{color('connections', '1;35')}: "
            f"{color(str(active), '1;32')} active / {color(str(total), '1;36')} total"
        )
        auth_line = (
            f"{color('auth', '1;35')}: "
            f"{color(str(accepted), '1;32')} ok / {color(str(rejected), '1;31')} fail"
        )
        traffic_in = (
            f"{color('traffic in', '1;35')}: "
            f"{color(format_bytes(bytes_in), '1;32')} "
            f"({color(format_bytes(int(rate_in)) + '/s', '0;32')})"
        )
        traffic_out = (
            f"{color('traffic out', '1;35')}: "
            f"{color(format_bytes(bytes_out), '1;36')} "
            f"({color(format_bytes(int(rate_out)) + '/s', '0;36')})"
        )
        box_lines = [header, ""] + stats_lines + \
            ["", conn_line, auth_line, "", traffic_in, traffic_out]
        panel = draw_box(box_lines, 64)
        sys.stdout.write("\033[2J\033[H" + panel + "\n")
        sys.stdout.flush()


async def run_server(config: ProxyConfig, stats: ProxyStats) -> None:
    server = await asyncio.start_server(
        lambda r, w: handle_client(r, w, config, stats),
        config.listen_host,
        config.listen_port,
    )
    addr = server.sockets[0].getsockname() if server.sockets else None
    logging.getLogger("proxy_receiver").info("Listening on %s", addr)
    async with server:
        if config.enable_tui:
            await asyncio.gather(server.serve_forever(), tui_loop(config, stats))
        else:
            await server.serve_forever()


def main() -> None:
    logging.basicConfig(level=logging.INFO,
                        format="%(asctime)s %(levelname)s %(message)s")
    config = build_config()
    stats = ProxyStats()
    asyncio.run(run_server(config, stats))


if __name__ == "__main__":
    main()
