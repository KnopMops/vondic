import os

from dotenv import load_dotenv

load_dotenv(dotenv_path=".env.webrtc")


class Config:
    SECRET_KEY = os.environ.get("SECRET_KEY") or "secret!"

    BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    DB_PATH = os.path.join(BASE_DIR, "database.db")

    DEBUG = os.environ.get("DEBUG", "True").lower() in ("true", "1", "t")

    HOST = os.environ.get("HOST", "0.0.0.0")
    PORT = int(os.environ.get("PORT", 5000))
