"""
Добавление колонок к уже существующим таблицам (create_all их не меняет).

Только DDL при отсутствии колонок — не заменяет полноценные Alembic-миграции.
"""
from __future__ import annotations

from sqlalchemy import inspect, text


def ensure_users_extended_columns(engine) -> None:
    """Колонки для новых токенов и moderation_warnings на таблице users."""
    insp = inspect(engine)
    if not insp.has_table("users"):
        return
    names = {c["name"] for c in insp.get_columns("users")}
    dialect = engine.dialect.name

    def run(sql: str) -> None:
        with engine.begin() as conn:
            conn.execute(text(sql))

    if dialect == "postgresql":
        if "access_token_lookup" not in names:
            run(
                "ALTER TABLE users ADD COLUMN IF NOT EXISTS access_token_lookup TEXT"
            )
        if "refresh_token_lookup" not in names:
            run(
                "ALTER TABLE users ADD COLUMN IF NOT EXISTS refresh_token_lookup TEXT"
            )
        if "moderation_warnings" not in names:
            run(
                "ALTER TABLE users ADD COLUMN IF NOT EXISTS moderation_warnings "
                "JSONB DEFAULT '[]'::jsonb NOT NULL"
            )
        if "reset_password_token" not in names:
            run(
                "ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_password_token TEXT"
            )
        if "reset_password_expires" not in names:
            run(
                "ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_password_expires TIMESTAMP"
            )
        run(
            "CREATE UNIQUE INDEX IF NOT EXISTS uq_users_access_token_lookup "
            "ON users (access_token_lookup) "
            "WHERE access_token_lookup IS NOT NULL"
        )
        run(
            "CREATE UNIQUE INDEX IF NOT EXISTS uq_users_refresh_token_lookup "
            "ON users (refresh_token_lookup) "
            "WHERE refresh_token_lookup IS NOT NULL"
        )
        return

    if "access_token_lookup" not in names:
        run("ALTER TABLE users ADD COLUMN access_token_lookup TEXT")
    if "refresh_token_lookup" not in names:
        run("ALTER TABLE users ADD COLUMN refresh_token_lookup TEXT")
    if "moderation_warnings" not in names:
        run("ALTER TABLE users ADD COLUMN moderation_warnings TEXT DEFAULT '[]'")
