import uuid
from datetime import datetime

from sqlalchemy.dialects.sqlite import FLOAT, INTEGER, TEXT, TIMESTAMP
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
    role = db.Column(TEXT, default="User")
    status = db.Column(TEXT, default="offline")
    balance = db.Column(FLOAT, default=0.0)
    is_messaging = db.Column(INTEGER, default=0)
    created_at = db.Column(TIMESTAMP, default=datetime.utcnow)
    updated_at = db.Column(
        TIMESTAMP, default=datetime.utcnow, onupdate=datetime.utcnow)

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
            "is_blocked": bool(self.is_blocked),
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
