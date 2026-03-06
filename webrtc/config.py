import os
from urllib.parse import quote_plus

from dotenv import load_dotenv

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
load_dotenv(dotenv_path=os.path.join(BASE_DIR, "backend", ".env.backend"))
load_dotenv(dotenv_path=".env.webrtc")


def _build_postgres_url() -> str | None:
    explicit = os.environ.get("POSTGRES_URL")
    if explicit:
        return explicit.replace("postgresql+psycopg2://", "postgresql://")
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
    return url.replace("postgresql+psycopg2://", "postgresql://")


class Config:
    SECRET_KEY = os.environ.get("SECRET_KEY") or "secret!"
    DATABASE_URL = (
        _build_postgres_url() or os.environ.get("DATABASE_URL") or ""
    ).replace("postgresql+psycopg2://", "postgresql://") or None
    DEBUG = os.environ.get("DEBUG", "True").lower() in ("true", "1", "t")
    HOST = os.environ.get("HOST", "0.0.0.0")
    PORT = int(os.environ.get("PORT", 5000))
    
    BACKEND_INTERNAL_URL = (
        os.environ.get("BACKEND_INTERNAL_URL") or "http://127.0.0.1:5050"
    )
    MESSAGE_ENCRYPTION_KEY = (
        os.environ.get("MESSAGE_ENCRYPTION_KEY")
        or "mPuUjRV-t-5eeaSrEFhVh4yZud-L7rv31SjYdXx9uIU="
    )
