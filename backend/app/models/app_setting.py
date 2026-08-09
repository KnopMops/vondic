from sqlalchemy import Column, JSON, String, Text
from app.core.database import Base

APP_DOWNLOADS_KEY = "app_downloads"


class AppSetting(Base):
    __tablename__ = "app_settings"

    key = Column(Text, primary_key=True)
    value_json = Column(JSON, nullable=False, default=dict)
