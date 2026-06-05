import base64
import hashlib
import logging
import os

from cryptography.fernet import Fernet, InvalidToken
from flask import current_app

logger = logging.getLogger(__name__)

_DEFAULT_SECRET = "you-will-never-guess"
_KEY_FILE = ".mail_credentials_key"


def _uploads_dir() -> str:
    return (
        current_app.config.get("UPLOADS_DIR")
        or os.environ.get("UPLOADS_DIR")
        or "/app/uploads"
    )


def _key_file_path() -> str:
    return os.path.join(_uploads_dir(), _KEY_FILE)


def _secret_derived_key(secret: str) -> bytes:
    digest = hashlib.sha256(secret.encode("utf-8")).digest()
    return base64.urlsafe_b64encode(digest)


def _normalize_key(raw: str | bytes | None) -> bytes | None:
    if not raw:
        return None
    if isinstance(raw, str):
        raw = raw.strip().encode("utf-8")
    try:
        Fernet(raw)
        return raw
    except Exception:
        return None


def _read_persistent_key() -> bytes | None:
    path = _key_file_path()
    if not os.path.isfile(path):
        return None
    try:
        return _normalize_key(open(path, "rb").read().strip())
    except OSError:
        return None


def _write_persistent_key(key: bytes) -> None:
    path = _key_file_path()
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "wb") as fh:
        fh.write(key)
    try:
        os.chmod(path, 0o600)
    except OSError:
        pass


def _ensure_persistent_key() -> bytes:
    existing = _read_persistent_key()
    if existing:
        return existing
    key = Fernet.generate_key()
    _write_persistent_key(key)
    return key


def _key_candidates() -> list[bytes]:
    seen: set[bytes] = set()
    ordered: list[bytes] = []

    def add(raw: str | bytes | None) -> None:
        key = _normalize_key(raw)
        if key and key not in seen:
            seen.add(key)
            ordered.append(key)

    add(current_app.config.get("MAIL_CREDENTIALS_KEY"))
    add(_read_persistent_key())

    secret = current_app.config.get("SECRET_KEY") or ""
    if secret:
        add(_secret_derived_key(secret))
    add(_secret_derived_key(_DEFAULT_SECRET))

    return ordered


def _primary_key() -> bytes:
    env_key = _normalize_key(current_app.config.get("MAIL_CREDENTIALS_KEY"))
    if env_key:
        return env_key
    return _ensure_persistent_key()


def _fernet_for_key(key: bytes) -> Fernet | None:
    try:
        return Fernet(key)
    except Exception:
        return None


def encrypt_mail_password(plain: str) -> str:
    f = _fernet_for_key(_primary_key())
    if not f:
        raise RuntimeError(
            "MAIL_CREDENTIALS_KEY or persistent mail key required for mail passwords"
        )
    return f.encrypt(plain.encode("utf-8")).decode("utf-8")


def decrypt_mail_password(encrypted: str) -> str:
    keys = _key_candidates()
    if not keys:
        raise RuntimeError(
            "MAIL_CREDENTIALS_KEY or persistent mail key required for mail passwords"
        )

    last_error: Exception | None = None
    for key in keys:
        f = _fernet_for_key(key)
        if not f:
            continue
        try:
            plain = f.decrypt(encrypted.encode("utf-8")).decode("utf-8")
            primary = _primary_key()
            if key != primary:
                logger.info(
                    "Re-encrypting mailbox password with current primary key"
                )
            return plain
        except InvalidToken as e:
            last_error = e
            continue

    raise ValueError("Invalid encrypted mail password") from last_error
