from sqlalchemy import JSON, TEXT

from app.core.extensions import db

APP_DOWNLOADS_KEY = "app_downloads"


class AppSetting(db.Model):
    __tablename__ = "app_settings"

    key = db.Column(TEXT, primary_key=True)
    value_json = db.Column(JSON, nullable=False, default=dict)
