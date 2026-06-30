import os

from dotenv import load_dotenv

load_dotenv(dotenv_path=".env.encproxy")


class Config:
    SECRET_KEY = os.environ.get("SECRET_KEY") or "encproxy-secret!"
    DEBUG = os.environ.get("DEBUG", "True").lower() in ("true", "1", "t")
    HOST = os.environ.get("HOST", "0.0.0.0")
    PORT = int(os.environ.get("PORT", 5100))
    CORS_ALLOWED_ORIGINS = os.environ.get("CORS_ALLOWED_ORIGINS", "")
    MAX_CONNECTIONS_PER_USER = int(os.environ.get("MAX_CONNECTIONS_PER_USER", 5))
