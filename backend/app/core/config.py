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
            "DATABASE_URL=postgresql://vondic:vondic123@localhost:5432/vondic"
        )

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
    YANDEX_CLIENT_ID = os.environ.get("YANDEX_CLIENT_ID")
    YANDEX_CLIENT_SECRET = os.environ.get("YANDEX_CLIENT_SECRET")
    YANDEX_REDIRECT_URI = os.environ.get("YANDEX_REDIRECT_URI")
    STRIPE_SECRET_KEY = os.environ.get("STRIPE_SECRET_KEY")
    STRIPE_WEBHOOK_SECRET = os.environ.get("STRIPE_WEBHOOK_SECRET")
    STRIPE_PRICE_ID = os.environ.get("STRIPE_PRICE_ID")
    OLLAMA_API_URL = os.environ.get(
        "OLLAMA_API_URL") or "http://localhost:11434"
    OLLAMA_MODEL = os.environ.get("OLLAMA_MODEL") or "llama3.1"
    SESSION_TTL_SECONDS = int(os.environ.get("SESSION_TTL_SECONDS", "2592000"))

    CACHE_REDIS_URL = _build_redis_url()

    if _is_redis_available(CACHE_REDIS_URL):
        CACHE_TYPE = os.environ.get("CACHE_TYPE") or "RedisCache"
    else:
        CACHE_TYPE = os.environ.get("CACHE_TYPE") or "SimpleCache"
    CACHE_DEFAULT_TIMEOUT = int(os.environ.get("CACHE_DEFAULT_TIMEOUT", "300"))
