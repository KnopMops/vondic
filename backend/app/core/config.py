import os

from dotenv import load_dotenv

basedir = os.path.abspath(os.path.dirname(__file__))
backend_dir = os.path.join(basedir, "../../")
load_dotenv(os.path.join(backend_dir, ".env.backend"))


class Config:
    SECRET_KEY = os.environ.get("SECRET_KEY") or "you-will-never-guess"
    BASE_DIR = os.path.abspath(os.path.join(
        os.path.dirname(__file__), "../../../"))
    SQLALCHEMY_DATABASE_URI = os.environ.get(
        "DATABASE_URL"
    ) or "sqlite:///" + os.path.join(BASE_DIR, "database.db")
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
    OLLAMA_API_URL = os.environ.get("OLLAMA_API_URL") or "http://localhost:11434"
    OLLAMA_MODEL = os.environ.get("OLLAMA_MODEL") or "llama3.1"
