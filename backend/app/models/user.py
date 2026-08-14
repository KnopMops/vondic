import uuid
from datetime import datetime

from sqlalchemy import Column, TEXT, INTEGER, JSON, TIMESTAMP, BigInteger, Float
from werkzeug.security import check_password_hash, generate_password_hash

from app.core.database import Base


class User(Base):
    __tablename__ = "users"
    id = Column(TEXT, primary_key=True, default=lambda: str(uuid.uuid4()))
    username = Column(TEXT, unique=True, nullable=False)
    email = Column(TEXT, unique=True, nullable=False)
    access_token = Column(TEXT)
    refresh_token = Column(TEXT)
    access_token_lookup = Column(TEXT, unique=True, nullable=True)
    refresh_token_lookup = Column(TEXT, unique=True, nullable=True)
    password_hash = Column(TEXT, nullable=False)
    avatar_url = Column(TEXT, default=None)
    description = Column(TEXT, default=None)
    is_verified = Column(INTEGER, default=0)
    socket_id = Column(TEXT)
    is_blocked = Column(INTEGER, default=0)
    is_blocked_at = Column(TIMESTAMP, default=None)
    blocked_by_admin = Column(TEXT, default=None)
    role = Column(TEXT, default="User")
    status = Column(TEXT, default="offline")
    last_seen = Column(TIMESTAMP, default=None)
    balance = Column(Float, default=0.0)
    bonus_balance = Column(Float, default=0.0)
    premium = Column(INTEGER, default=0)
    premium_started_at = Column(TIMESTAMP, default=None)
    premium_expired_at = Column(TIMESTAMP, default=None)
    disk_usage = Column(BigInteger, default=0)
    storage_bonus = Column(BigInteger, default=0)
    is_messaging = Column(INTEGER, default=0)
    two_factor_enabled = Column(INTEGER, default=0)
    two_factor_method = Column(TEXT, default=None)
    two_factor_secret = Column(TEXT, default=None)
    two_factor_email_code = Column(TEXT, default=None)
    two_factor_email_code_expires = Column(TIMESTAMP, default=None)
    login_alert_enabled = Column(INTEGER, default=0)
    profile_bg_theme = Column(TEXT, default=None)
    profile_bg_gradient = Column(TEXT, default=None)
    profile_bg_image = Column(TEXT, default=None)
    gifts = Column(JSON, default=list)
    storis = Column(JSON, default=list)
    pinned_chats = Column(JSON, default=list)
    is_developer = Column(INTEGER, default=0)
    api_key_hash = Column(TEXT, default=None)
    api_key = Column(TEXT, default=None)
    mail_api_permissions = Column(
        JSON,
        default=lambda: {"send": False, "read": False, "delete": False},
    )
    privacy_settings = Column(JSON, default=lambda: {"show_email": False})
    moderation_warnings = Column(JSON, default=list)
    cloud_password_hash = Column(TEXT, default=None)
    cloud_password_reset_month = Column(INTEGER, default=None)
    cloud_password_reset_count = Column(INTEGER, default=0)
    reset_password_token = Column(TEXT, default=None)
    reset_password_expires = Column(TIMESTAMP, default=None)
    reset_ip_required = Column(TEXT, default=None)
    reset_verify_token = Column(TEXT, default=None)
    reset_verify_expires = Column(TIMESTAMP, default=None)
    e2e_backup_salt = Column(TEXT, default=None)
    e2e_wrapped_device_secret = Column(TEXT, default=None)
    yandex_id = Column(TEXT, default=None)
    yandex_token = Column(TEXT, default=None)
    storage_rules = Column(JSON, default=None)
    video_likes = Column(TEXT, default=None)
    video_watch_later = Column(TEXT, default=None)
    video_history = Column(TEXT, default=None)
    registration_ip = Column(TEXT, default=None)
    is_blocked_system = Column(INTEGER, default=0)
    created_at = Column(TIMESTAMP, default=datetime.utcnow)
    updated_at = Column(
        TIMESTAMP, default=datetime.utcnow, onupdate=datetime.utcnow)

    @property
    def disk_limit(self):
        base = 512 * 1024 * 1024
        return base + (self.storage_bonus or 0)

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

    def __repr__(self):
        return f"<User {self.username}>"

    def to_dict(self, viewer_id: str | None = None):
        from app.utils.user_privacy import redact_user_dict

        data = {
            "id": self.id,
            "username": self.username,
            "email": self.email,
            "role": self.role,
            "status": self.status,
            "balance": self.balance,
            "bonus_balance": getattr(self, 'bonus_balance', 0.0) or 0.0,
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
            "description": self.description,
            "storis": self.storis or [],
            "pinned_chats": self.pinned_chats or [],
            "is_blocked": bool(self.is_blocked),
            "blocked_by_admin": self.blocked_by_admin,
            "two_factor_enabled": bool(self.two_factor_enabled),
            "two_factor_method": self.two_factor_method,
            "login_alert_enabled": bool(self.login_alert_enabled),
            "is_developer": bool(self.is_developer),
            "yandex_id": self.yandex_id,
            "yandex_disk_connected": bool(self.yandex_token),
            "privacy_settings": self.privacy_settings or {"show_email": False},
            "last_seen": (
                f"{self.last_seen.isoformat()}Z"
                if self.last_seen and self.last_seen.tzinfo is None
                else self.last_seen.isoformat() if self.last_seen else None
            ),
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
        return redact_user_dict(data, viewer_id)
