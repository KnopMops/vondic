import secrets
import struct
from typing import Optional

from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.hkdf import HKDF

from .config import ProxyStats

MAGIC = b"PXE1"
VERSION = 1
HANDSHAKE_NONCE_SIZE = 32
FRAME_NONCE_SIZE = 12


def derive_session_key(
    master_key: bytes,
    client_nonce: bytes,
    server_nonce: bytes,
) -> bytes:
    hkdf = HKDF(
        algorithm=hashes.SHA256(),
        length=32,
        salt=client_nonce + server_nonce,
        info=b"proxy_receiver_session",
    )
    return hkdf.derive(master_key)


async def read_frame(
    reader,
    max_frame_size: int,
) -> Optional[bytes]:
    header = await reader.readexactly(4)
    frame_len = struct.unpack(">I", header)[0]
    if frame_len == 0:
        return None
    if frame_len > max_frame_size:
        raise ValueError("Frame too large")
    payload = await reader.readexactly(frame_len)
    return payload


async def write_frame(writer, payload: bytes) -> None:
    writer.write(struct.pack(">I", len(payload)) + payload)
    await writer.drain()


async def encrypt_and_send(
    writer,
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
    reader,
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


async def read_api_key(reader, max_frame_size: int) -> Optional[str]:
    payload = await read_frame(reader, max_frame_size)
    if payload is None:
        return None
    return payload.decode(errors="ignore")


async def send_api_key(writer, api_key: Optional[str]) -> None:
    if not api_key:
        return
    await write_frame(writer, api_key.encode())


async def perform_handshake(
    reader,
    writer,
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
    reader,
    writer,
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

