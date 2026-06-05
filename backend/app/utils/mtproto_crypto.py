import base64
import hashlib
import os

from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes


def _get_key():
    return os.environ.get(
        "MESSAGE_ENCRYPTION_KEY",
        "mPuUjRV-t-5eeaSrEFhVh4yZud-L7rv31SjYdXx9uIU=",
    )


_key_bytes = _get_key().encode()
_mt_key = hashlib.sha256(_key_bytes + b"key").digest()
_mt_iv = hashlib.sha256(_key_bytes + b"iv").digest()


def mtproto_decrypt(ciphertext: str | None) -> str | None:
    """Расшифровывает строку с префиксом mt: (тот же алгоритм, что и в webrtc)."""
    if not ciphertext:
        return None
    if not isinstance(ciphertext, str) or not ciphertext.startswith("mt:"):
        return ciphertext

    try:
        b64 = ciphertext[3:]
        raw = base64.urlsafe_b64decode(b64.encode())
        iv1 = _mt_iv[:16]
        iv2 = _mt_iv[16:32]
        cipher = Cipher(algorithms.AES(_mt_key), modes.ECB())
        decryptor = cipher.decryptor()
        prev_c = iv1
        prev_p = iv2
        out = bytearray()
        for i in range(0, len(raw), 16):
            c_block = raw[i: i + 16]
            xored = bytes(a ^ b for a, b in zip(c_block, prev_p))
            dec = decryptor.update(xored)
            p_block = bytes(a ^ b for a, b in zip(dec, prev_c))
            out.extend(p_block)
            prev_c = c_block
            prev_p = p_block
        if len(out) < 4:
            return None
        msg_len = int.from_bytes(out[:4], "big")
        body = out[4: 4 + msg_len]
        return body.decode("utf-8")
    except Exception:
        return ciphertext
