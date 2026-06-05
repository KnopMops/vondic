import os
from urllib.parse import quote_plus

from dotenv import load_dotenv

basedir = os.path.abspath(os.path.dirname(__file__))
backend_dir = os.path.join(basedir, "../../")
load_dotenv(os.path.join(backend_dir, ".env.backend"))


def _build_postgres_url() -> str | None:
    explicit = os.environ.get("POSTGRES_URL")
    if explicit:
        return explicit
    host = os.environ.get("POSTGRES_HOST")
    if not host:
        return None
    user = os.environ.get("POSTGRES_USER", "postgres")
    password = os.environ.get("POSTGRES_PASSWORD", "")
    port = os.environ.get("POSTGRES_PORT", "5432")
    db = os.environ.get("POSTGRES_DB", "postgres")
    auth = f"{user}@"
    if password:
        auth = f"{user}:{quote_plus(password)}@"
    url = f"postgresql+psycopg2://{auth}{host}:{port}/{db}"
    sslmode = os.environ.get("POSTGRES_SSLMODE")
    if sslmode:
        url = f"{url}?sslmode={sslmode}"
    return url


def _build_redis_url() -> str | None:
    explicit = os.environ.get("REDIS_URL")
    if explicit:
        return explicit
    host = os.environ.get("REDIS_HOST")
    if not host:
        return None
    port = os.environ.get("REDIS_PORT", "6379")
    db = os.environ.get("REDIS_DB", "0")
    password = os.environ.get("REDIS_PASSWORD")
    if password:
        return f"redis://:{quote_plus(password)}@{host}:{port}/{db}"
    return f"redis://{host}:{port}/{db}"


def _is_redis_available(redis_url: str | None) -> bool:
    return bool(redis_url)


class Config:
    SECRET_KEY = os.environ.get("SECRET_KEY") or "you-will-never-guess"
    BASE_DIR = os.path.abspath(os.path.join(
        os.path.dirname(__file__), "../../../"))

    SQLALCHEMY_DATABASE_URI = (
        _build_postgres_url()
        or os.environ.get("DATABASE_URL")
    )

    if not SQLALCHEMY_DATABASE_URI:
        raise ValueError(
            "PostgreSQL не настроен! Установите POSTGRES_* переменные или DATABASE_URL\n"
            "Пример:\n"
            "POSTGRES_HOST=localhost\n"
            "POSTGRES_PORT=5432\n"
            "POSTGRES_DB=vondic\n"
            "POSTGRES_USER=vondic\n"
            "POSTGRES_PASSWORD=vondic123\n"
            "Или:\n"
            "DATABASE_URL=postgresql://vondic:vondic123@localhost:5432/vondic")

    SQLALCHEMY_TRACK_MODIFICATIONS = False
    MAIL_SERVER = os.environ.get("MAIL_SERVER")
    MAIL_PORT = int(os.environ.get("MAIL_PORT") or 587)
    MAIL_USE_TLS = os.environ.get(
        "MAIL_USE_TLS", "True").lower() in ("true", "1", "t")
    MAIL_USE_SSL = os.environ.get(
        "MAIL_USE_SSL", "False").lower() in ("true", "1", "t")
    MAIL_USERNAME = os.environ.get("MAIL_USERNAME")
    MAIL_PASSWORD = os.environ.get("MAIL_PASSWORD")
    MAIL_DEFAULT_SENDER = os.environ.get("MAIL_DEFAULT_SENDER")
    MAIL_DOMAIN = os.environ.get("MAIL_DOMAIN") or "vondic.ru"
    MAIL_TLS_SERVER_NAME = os.environ.get(
        "MAIL_TLS_SERVER_NAME") or "mail.vondic.ru"
    MAIL_IMAP_HOST = os.environ.get("MAIL_IMAP_HOST") or "mail.vondic.ru"
    MAIL_IMAP_PORT = int(os.environ.get("MAIL_IMAP_PORT") or 993)
    MAIL_IMAP_USE_SSL = os.environ.get(
        "MAIL_IMAP_USE_SSL", "True"
    ).lower() in ("true", "1", "t")
    MAIL_IMAP_TLS_INSECURE = os.environ.get(
        "MAIL_IMAP_TLS_INSECURE", "False"
    ).lower() in ("true", "1", "t")
    MAIL_SMTP_INTERNAL_HOST = os.environ.get("MAIL_SMTP_INTERNAL_HOST")
    MAIL_SMTP_INTERNAL_PORT = os.environ.get("MAIL_SMTP_INTERNAL_PORT")
    MAIL_CREDENTIALS_KEY = os.environ.get("MAIL_CREDENTIALS_KEY")
    MAIL_PROVISION_ENABLED = os.environ.get(
        "MAIL_PROVISION_ENABLED", "0"
    ).lower() in ("true", "1", "t")
    MAIL_DOCKER_CONTAINER = os.environ.get(
        "MAIL_DOCKER_CONTAINER") or "mailserver"
    MAIL_DOCKER_BIN = os.environ.get("MAIL_DOCKER_BIN") or "/usr/bin/docker"
    MAIL_DOCKER_SOCKET = os.environ.get(
        "MAIL_DOCKER_SOCKET") or "/var/run/docker.sock"
    MAIL_NOREPLY_ADDRESS = os.environ.get(
        "MAIL_NOREPLY_ADDRESS") or "noreply@vondic.ru"
    MAIL_NOREPLY_SMTP_PASSWORD = os.environ.get("MAIL_NOREPLY_SMTP_PASSWORD")
    MAIL_NOREPLY_API_PASSWORD = os.environ.get("MAIL_NOREPLY_API_PASSWORD")
    MAIL_NOREPLY_API_PASSWORD_HASH = os.environ.get(
        "MAIL_NOREPLY_API_PASSWORD_HASH"
    )
    YANDEX_CLIENT_ID = os.environ.get("YANDEX_CLIENT_ID")
    YANDEX_CLIENT_SECRET = os.environ.get("YANDEX_CLIENT_SECRET")
    YANDEX_REDIRECT_URI = os.environ.get("YANDEX_REDIRECT_URI")
    YANDEX_SMARTCAPTCHA_SERVER_KEY = os.environ.get(
        "YANDEX_SMARTCAPTCHA_SERVER_KEY"
    )
    STRIPE_SECRET_KEY = os.environ.get("STRIPE_SECRET_KEY")
    STRIPE_WEBHOOK_SECRET = os.environ.get("STRIPE_WEBHOOK_SECRET")
    STRIPE_PRICE_ID = os.environ.get("STRIPE_PRICE_ID")
    OLLAMA_API_URL = os.environ.get(
        "OLLAMA_API_URL") or "http://localhost:11434"
    OLLAMA_MODEL = os.environ.get("OLLAMA_MODEL") or "llama3.1"
    SESSION_TTL_SECONDS = int(os.environ.get("SESSION_TTL_SECONDS", "259200"))
    FRONTEND_URL = os.environ.get("FRONTEND_URL") or "http://localhost:3000"
    MESSAGE_ENCRYPTION_KEY = os.environ.get(
        "MESSAGE_ENCRYPTION_KEY",
        "mPuUjRV-t-5eeaSrEFhVh4yZud-L7rv31SjYdXx9uIU=",
    )

    CACHE_REDIS_URL = _build_redis_url()

    if _is_redis_available(CACHE_REDIS_URL):
        CACHE_TYPE = os.environ.get("CACHE_TYPE") or "RedisCache"
    else:
        CACHE_TYPE = os.environ.get("CACHE_TYPE") or "SimpleCache"
    CACHE_DEFAULT_TIMEOUT = int(os.environ.get("CACHE_DEFAULT_TIMEOUT", "300"))
