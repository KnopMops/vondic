import asyncio
import logging
from typing import Optional, Tuple
from urllib.parse import urlsplit

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from .config import HTTP_HEADER_LIMIT, ProxyConfig, ProxyStats, build_config
from .crypto import (
    encrypt_and_send,
    perform_client_handshake,
    perform_handshake,
    read_api_key,
    recv_and_decrypt,
    send_api_key,
)
from .tui import tui_loop


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
