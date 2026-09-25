import base64
import hashlib
import logging
import os
from typing import Optional

from cryptography.fernet import Fernet
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.primitives.kdf.argon2 import Argon2id
from sqlalchemy import TEXT, String
from sqlalchemy.types import TypeDecorator

logger = logging.getLogger(__name__)

# Fallback default key if none configured in env
DEFAULT_ENCRYPTION_KEY = os.environ.get(
    "MESSAGE_ENCRYPTION_KEY",
    "mPuUjRV-t-5eeaSrEFhVh4yZud-L7rv31SjYdXx9uIU=",
)


def _derive_fernet_key(secret: str) -> bytes:
    """Гарантирует получение валидного 32-байтного urlsafe-base64 ключа для Fernet."""
    if not secret:
        secret = DEFAULT_ENCRYPTION_KEY
    try:
        raw = base64.urlsafe_b64decode(secret.encode("ascii"))
        if len(raw) == 32:
            return secret.encode("ascii")
    except Exception:
        pass
    # Derive 32 bytes using SHA-256
    digest = hashlib.sha256(secret.encode("utf-8")).digest()
    return base64.urlsafe_b64encode(digest)


def _derive_mtproto_key_iv(secret: str):
    """Derive key and IV for MTProto-compatible messages (same as webrtc service)."""
    raw_key = secret.encode("ascii") if isinstance(secret, str) else secret
    try:
        decoded = base64.urlsafe_b64decode(raw_key)
        if len(decoded) >= 32:
            raw_key = decoded
    except Exception:
        pass
    key = hashlib.sha256(raw_key + b"key").digest()
    iv = hashlib.sha256(raw_key + b"iv").digest()
    return key, iv


_FERNET_KEY = _derive_fernet_key(DEFAULT_ENCRYPTION_KEY)
_FERNET_CIPHER = Fernet(_FERNET_KEY)
_MT_KEY, _MT_IV = _derive_mtproto_key_iv(DEFAULT_ENCRYPTION_KEY)


# ==========================================
# 1. СОВРЕМЕННОЕ ХЭШИРОВАНИЕ НА ARGON2ID
# ==========================================

def hash_password(password: str) -> str:
    """
    Хэширует пароль по современной технологии Argon2id (RFC 9106, OWASP recommendation).
    Memory-hard, устойчив к атакам на GPU/ASIC/FPGA.
    Формат: $argon2id$v=19$m=65536,t=2,p=4$<salt>$<hash>
    """
    if not password:
        raise ValueError("Пароль не может быть пустым")

    salt = os.urandom(16)
    kdf = Argon2id(
        salt=salt,
        length=32,
        iterations=2,
        lanes=4,
        memory_cost=65536,
    )
    derived = kdf.derive(password.encode("utf-8"))
    b64_salt = base64.urlsafe_b64encode(salt).decode("ascii")
    b64_hash = base64.urlsafe_b64encode(derived).decode("ascii")
    return f"$argon2id$v=19$m=65536,t=2,p=4${b64_salt}${b64_hash}"


def verify_password(password: str, hash_str: Optional[str]) -> bool:
    """
    Проверяет пароль:
    1. Если хэш на Argon2id — проверяет через Argon2id.
    2. Если хэш старый (pbkdf2 / scrypt / bcrypt) — проверяет через werkzeug/bcrypt для обратной совместимости.
    """
    if not password or not hash_str:
        return False

    if hash_str.startswith("$argon2id$"):
        try:
            parts = hash_str.split("$")
            # Expected parts: ['', 'argon2id', 'v=19', 'm=65536,t=2,p=4', b64_salt, b64_hash]
            if len(parts) < 6:
                return False
            params = dict(item.split("=") for item in parts[3].split(","))
            m = int(params.get("m", 65536))
            t = int(params.get("t", 2))
            p = int(params.get("p", 4))
            salt = base64.urlsafe_b64decode(parts[4].encode("ascii"))
            expected = base64.urlsafe_b64decode(parts[5].encode("ascii"))

            kdf = Argon2id(
                salt=salt,
                length=len(expected),
                iterations=t,
                lanes=p,
                memory_cost=m,
            )
            kdf.verify(password.encode("utf-8"), expected)
            return True
        except Exception as e:
            logger.debug(f"Argon2id verify failed: {e}")
            return False

    # Обратная совместимость с устаревшими хэшами (PBKDF2/scrypt/bcrypt)
    try:
        from werkzeug.security import check_password_hash
        if check_password_hash(hash_str, password):
            return True
    except Exception:
        pass

    try:
        import bcrypt
        if hash_str.startswith("$2b$") or hash_str.startswith("$2a$"):
            return bcrypt.checkpw(password.encode("utf-8"), hash_str.encode("utf-8"))
    except Exception:
        pass

    return False


def needs_rehash(hash_str: Optional[str]) -> bool:
    """Возвращает True, если сохранённый хэш устарел (не на Argon2id) и требует обновления при логине."""
    if not hash_str:
        return True
    return not hash_str.startswith("$argon2id$")


def hash_token(token: Optional[str]) -> Optional[str]:
    """Быстрый криптографический хэш токена (SHA-256) для безопасного поиска и сравнения."""
    if not token:
        return None
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


# ==========================================
# 2. ШИФРОВАНИЕ И ДЕШИФРОВАНИЕ ПОЛЕЙ БД
# ==========================================

def _mtproto_decrypt(ciphertext: str) -> Optional[str]:
    """Дешифрование MTProto формата (из webrtc сервиса)."""
    try:
        b64 = ciphertext[3:]
        raw = base64.urlsafe_b64decode(b64.encode("ascii"))
        iv1 = _MT_IV[:16]
        iv2 = _MT_IV[16:32]
        cipher = Cipher(algorithms.AES(_MT_KEY), modes.ECB())
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
        return None


def encrypt_field(plaintext: Optional[str]) -> Optional[str]:
    """
    Шифрует строковое поле для безопасного хранения в базе данных.
    В базе данных хранится только шифротекст (защита от утечки БД).
    """
    if plaintext is None:
        return None
    if not isinstance(plaintext, str):
        plaintext = str(plaintext)
    if plaintext == "":
        return ""

    # Если уже зашифровано, возвращаем без повторного шифрования
    if plaintext.startswith("gAAAAA") or plaintext.startswith("mt:") or plaintext.startswith("e2e:"):
        return plaintext

    try:
        encrypted_bytes = _FERNET_CIPHER.encrypt(plaintext.encode("utf-8"))
        return encrypted_bytes.decode("ascii")
    except Exception as e:
        logger.error(f"Field encryption failed: {e}")
        return plaintext


def decrypt_field(ciphertext: Optional[str]) -> Optional[str]:
    """
    Дешифрует строковое поле при чтении из базы данных.
    Поддерживает Fernet, MTProto ('mt:') и E2E.
    Если текст не зашифрован (старая запись), возвращает его как есть без ошибок.
    """
    if ciphertext is None:
        return None
    if not isinstance(ciphertext, str):
        return str(ciphertext)
    if ciphertext == "":
        return ""

    # E2E оставляем клиенту
    if ciphertext.startswith("e2e:"):
        return ciphertext

    # MTProto формат WebRTC
    if ciphertext.startswith("mt:"):
        dec = _mtproto_decrypt(ciphertext)
        if dec is not None:
            return dec
        return ciphertext

    # Fernet формат
    if ciphertext.startswith("gAAAAA"):
        try:
            decrypted_bytes = _FERNET_CIPHER.decrypt(ciphertext.encode("ascii"))
            return decrypted_bytes.decode("utf-8")
        except Exception:
            # Если не удалось расшифровать, возвращаем как есть
            return ciphertext

    # Если это незашифрованный текст из старой базы
    return ciphertext


# ==========================================
# 3. ПРОЗРАЧНЫЕ SQLALCHEMY ТИПЫ ДЛЯ БД
# ==========================================

class EncryptedText(TypeDecorator):
    """
    Прозрачный тип SQLAlchemy TEXT:
    - При сохранении в БД автоматически шифрует текст.
    - При чтении из БД автоматически дешифрует обратно.
    """
    impl = TEXT
    cache_ok = True

    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        return encrypt_field(value)

    def process_result_value(self, value, dialect):
        if value is None:
            return None
        return decrypt_field(value)


class EncryptedString(TypeDecorator):
    """
    Прозрачный тип SQLAlchemy String:
    - При сохранении в БД автоматически шифрует текст.
    - При чтении из БД автоматически дешифрует обратно.
    """
    impl = String
    cache_ok = True

    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        return encrypt_field(value)

    def process_result_value(self, value, dialect):
        if value is None:
            return None
        return decrypt_field(value)
