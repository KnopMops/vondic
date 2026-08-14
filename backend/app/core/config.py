import os
from urllib.parse import quote_plus
from dotenv import load_dotenv
from pydantic_settings import BaseSettings

basedir = os.path.abspath(os.path.dirname(__file__))
backend_dir = os.path.join(basedir, "../../")
load_dotenv(os.path.join(backend_dir, ".env.backend"))


def make_async_database_url(url: str) -> str:
    if not url:
        return url
    if url.startswith("postgresql+psycopg2://"):
        return url.replace("postgresql+psycopg2://", "postgresql+asyncpg://", 1)
    if url.startswith("postgresql://"):
        return url.replace("postgresql://", "postgresql+asyncpg://", 1)
    if not url.startswith("postgresql+asyncpg://"):
        return f"postgresql+asyncpg://{url.split('://', 1)[-1]}"
    return url


def get_async_database_url(explicit: str | None = None) -> str:
    url = explicit or os.environ.get("DATABASE_URL") or os.environ.get("POSTGRES_URL")
    if not url:
        host = os.environ.get("POSTGRES_HOST", "localhost")
        user = os.environ.get("POSTGRES_USER", "postgres")
        password = os.environ.get("POSTGRES_PASSWORD", "")
        port = os.environ.get("POSTGRES_PORT", "5432")
        db = os.environ.get("POSTGRES_DB", "vondic")
        auth = f"{user}@"
        if password:
            auth = f"{user}:{quote_plus(password)}@"
        url = f"postgresql://{auth}{host}:{port}/{db}"

    return make_async_database_url(url)


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


class Settings(BaseSettings):
    SECRET_KEY: str = os.environ.get("SECRET_KEY", "you-will-never-guess")
    BASE_DIR: str = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../"))

    DATABASE_URL: str = os.environ.get("DATABASE_URL") or get_async_database_url()

    @property
    def ASYNC_DATABASE_URL(self) -> str:
        return make_async_database_url(self.DATABASE_URL)

    # S3 / MinIO Settings
    S3_ENDPOINT: str = os.environ.get("S3_ENDPOINT", "http://minio:9000")
    S3_ACCESS_KEY: str = os.environ.get("S3_ACCESS_KEY", "vondic")
    S3_SECRET_KEY: str = os.environ.get("S3_SECRET_KEY", "Dim4566212Len")
    S3_REGION: str = os.environ.get("S3_REGION", "us-east-1")
    S3_BUCKET: str = os.environ.get("S3_BUCKET", "uploads")
    S3_PUBLIC_URL: str = os.environ.get("S3_PUBLIC_URL", "https://s3.vondic.ru")

    # RabbitMQ Settings
    RABBITMQ_URL: str = os.environ.get("RABBITMQ_URL", "amqp://guest:guest@rabbitmq:5672/%2F")

    # Mail Settings
    MAIL_SERVER: str | None = os.environ.get("MAIL_SERVER")
    MAIL_PORT: int = int(os.environ.get("MAIL_PORT", "587"))
    MAIL_USE_TLS: bool = os.environ.get("MAIL_USE_TLS", "True").lower() in ("true", "1", "t")
    MAIL_USE_SSL: bool = os.environ.get("MAIL_USE_SSL", "False").lower() in ("true", "1", "t")
    MAIL_USERNAME: str | None = os.environ.get("MAIL_USERNAME")
    MAIL_PASSWORD: str | None = os.environ.get("MAIL_PASSWORD")
    MAIL_DEFAULT_SENDER: str | None = os.environ.get("MAIL_DEFAULT_SENDER")
    MAIL_DOMAIN: str = os.environ.get("MAIL_DOMAIN", "vondic.ru")
    MAIL_NOREPLY_ADDRESS: str = os.environ.get("MAIL_NOREPLY_ADDRESS", "noreply@vondic.ru")

    # Integration Settings
    YANDEX_CLIENT_ID: str | None = os.environ.get("YANDEX_CLIENT_ID")
    YANDEX_CLIENT_SECRET: str | None = os.environ.get("YANDEX_CLIENT_SECRET")
    YANDEX_REDIRECT_URI: str | None = os.environ.get("YANDEX_REDIRECT_URI")
    YANDEX_SMARTCAPTCHA_SERVER_KEY: str | None = os.environ.get("YANDEX_SMARTCAPTCHA_SERVER_KEY")
    STRIPE_SECRET_KEY: str | None = os.environ.get("STRIPE_SECRET_KEY")
    STRIPE_WEBHOOK_SECRET: str | None = os.environ.get("STRIPE_WEBHOOK_SECRET")
    OLLAMA_API_URL: str = os.environ.get("OLLAMA_API_URL", "http://localhost:11434")
    OLLAMA_MODEL: str = os.environ.get("OLLAMA_MODEL", "llama3.1")
    SESSION_TTL_SECONDS: int = int(os.environ.get("SESSION_TTL_SECONDS", "259200"))
    FRONTEND_URL: str = os.environ.get("FRONTEND_URL", "http://localhost:3000")
    MESSAGE_ENCRYPTION_KEY: str = os.environ.get(
        "MESSAGE_ENCRYPTION_KEY", "mPuUjRV-t-5eeaSrEFhVh4yZud-L7rv31SjYdXx9uIU=")

    # NVIDIA AI Settings
    NVIDIA_API_KEY: str = os.environ.get(
        "NVIDIA_API_KEY", "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")
    NVIDIA_BASE_URL: str = os.environ.get("NVIDIA_BASE_URL", "https://integrate.api.nvidia.com/v1")
    NVIDIA_MODEL: str = os.environ.get("NVIDIA_MODEL", "z-ai/glm-5.2")

    CACHE_REDIS_URL: str | None = _build_redis_url()

    class Config:
        extra = "ignore"


settings = Settings()
Config = settings
