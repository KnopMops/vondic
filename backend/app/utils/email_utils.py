"""Нормализация email и поиск пользователя без учёта регистра."""

from __future__ import annotations

from sqlalchemy import func

from app.core.extensions import db
from app.models.user import User


def normalize_email(email: str | None) -> str:
    return (email or "").strip().lower()


def find_user_by_email(email: str | None) -> User | None:
    norm = normalize_email(email)
    if not norm or "@" not in norm:
        return None
    return User.query.filter(func.lower(User.email) == norm).first()


def email_exists(email: str | None) -> bool:
    return find_user_by_email(email) is not None
