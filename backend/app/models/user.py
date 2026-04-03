import uuid
from datetime import datetime

from sqlalchemy import TEXT, INTEGER, JSON, TIMESTAMP, BigInteger, Float
from werkzeug.security import check_password_hash, generate_password_hash

from app.core.extensions import db

class User(db.Model):
    __tablename__ = "users"
    id = db.Column(TEXT, primary_key=True, default=lambda: str(uuid.uuid4()))
    username = db.Column(TEXT, unique=True, nullable=False)
    email = db.Column(TEXT, unique=True, nullable=False)
    access_token = db.Column(TEXT)
    refresh_token = db.Column(TEXT)
    password_hash = db.Column(TEXT, nullable=False)
    avatar_url = db.Column(TEXT, default=None)
    is_verified = db.Column(INTEGER, default=0)
    socket_id = db.Column(TEXT)
    is_blocked = db.Column(INTEGER, default=0)
    is_blocked_at = db.Column(TIMESTAMP, default=None)
    blocked_by_admin = db.Column(TEXT, default=None)
    role = db.Column(TEXT, default="User")
    status = db.Column(TEXT, default="offline")
    balance = db.Column(Float, default=0.0)
    premium = db.Column(INTEGER, default=0)
    premium_started_at = db.Column(TIMESTAMP, default=None)
    premium_expired_at = db.Column(TIMESTAMP, default=None)
    disk_usage = db.Column(BigInteger, default=0)
    storage_bonus = db.Column(BigInteger, default=0)
    is_messaging = db.Column(INTEGER, default=0)
    two_factor_enabled = db.Column(INTEGER, default=0)
    two_factor_method = db.Column(TEXT, default=None)
    two_factor_secret = db.Column(TEXT, default=None)
    two_factor_email_code = db.Column(TEXT, default=None)
    two_factor_email_code_expires = db.Column(TIMESTAMP, default=None)
    login_alert_enabled = db.Column(INTEGER, default=0)
    profile_bg_theme = db.Column(TEXT, default=None)
    profile_bg_gradient = db.Column(TEXT, default=None)
    profile_bg_image = db.Column(TEXT, default=None)
    gifts = db.Column(JSON, default=list)
    storis = db.Column(JSON, default=list)
    pinned_chats = db.Column(JSON, default=list)
    is_developer = db.Column(INTEGER, default=0)
    api_key_hash = db.Column(TEXT, default=None)
    api_key = db.Column(TEXT, default=None)
    privacy_settings = db.Column(JSON, default=lambda: {"show_email": True})
    cloud_password_hash = db.Column(TEXT, default=None)
    cloud_password_reset_month = db.Column(INTEGER, default=None)
    cloud_password_reset_count = db.Column(INTEGER, default=0)
    created_at = db.Column(TIMESTAMP, default=datetime.utcnow)
    updated_at = db.Column(
        TIMESTAMP, default=datetime.utcnow, onupdate=datetime.utcnow)

    @property
    def disk_limit(self):
        base = 5 * 1024 * 1024 * 1024 if self.premium else 1 * 1024 * 1024 * 1024
        return base + (self.storage_bonus or 0)

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

    def __repr__(self):
        return f"<User {self.username}>"

    def to_dict(self):
        return {
            "id": self.id,
            "username": self.username,
            "email": self.email,
            "role": self.role,
            "status": self.status,
            "balance": self.balance,
            "gifts": self.gifts or [],
            "premium": bool(self.premium),
            "premium_started_at": self.premium_started_at.isoformat()
            if self.premium_started_at
            else None,
            "premium_expired_at": self.premium_expired_at.isoformat()
            if self.premium_expired_at
            else None,
            "disk_usage": self.disk_usage,
            "disk_limit": self.disk_limit,
            "storage_bonus": self.storage_bonus,
            "profile_bg_theme": self.profile_bg_theme,
            "profile_bg_gradient": self.profile_bg_gradient,
            "profile_bg_image": self.profile_bg_image,
            "avatar_url": self.avatar_url,
            "storis": self.storis or [],
            "pinned_chats": self.pinned_chats or [],
            "is_blocked": bool(self.is_blocked),
            "blocked_by_admin": self.blocked_by_admin,
            "two_factor_enabled": bool(self.two_factor_enabled),
            "two_factor_method": self.two_factor_method,
            "login_alert_enabled": bool(self.login_alert_enabled),
            "is_developer": bool(self.is_developer),
            "privacy_settings": self.privacy_settings or {"show_email": True},
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
