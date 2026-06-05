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
        if "e2e_backup_salt" not in names:
            run(
                "ALTER TABLE users ADD COLUMN IF NOT EXISTS e2e_backup_salt TEXT"
            )
        if "e2e_wrapped_device_secret" not in names:
            run(
                "ALTER TABLE users ADD COLUMN IF NOT EXISTS e2e_wrapped_device_secret TEXT"
            )
        if "mail_api_permissions" not in names:
            run(
                "ALTER TABLE users ADD COLUMN IF NOT EXISTS mail_api_permissions "
                "JSONB DEFAULT '{\"send\": false, \"read\": false, \"delete\": false}'::jsonb"
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
    if "e2e_backup_salt" not in names:
        run("ALTER TABLE users ADD COLUMN e2e_backup_salt TEXT")
    if "e2e_wrapped_device_secret" not in names:
        run("ALTER TABLE users ADD COLUMN e2e_wrapped_device_secret TEXT")
    if "mail_api_permissions" not in names:
        run(
            "ALTER TABLE users ADD COLUMN mail_api_permissions TEXT "
            "DEFAULT '{\"send\": false, \"read\": false, \"delete\": false}'"
        )


def ensure_posts_social_community_column(engine) -> None:
    insp = inspect(engine)
    if not insp.has_table("posts"):
        return
    names = {c["name"] for c in insp.get_columns("posts")}
    if "social_community_id" in names:
        return
    dialect = engine.dialect.name

    def run(sql: str) -> None:
        with engine.begin() as conn:
            conn.execute(text(sql))

    if dialect == "postgresql":
        run(
            "ALTER TABLE posts ADD COLUMN IF NOT EXISTS "
            "social_community_id TEXT REFERENCES social_communities(id)"
        )
    else:
        run("ALTER TABLE posts ADD COLUMN social_community_id TEXT")


def ensure_social_communities_cover_column(engine) -> None:
    insp = inspect(engine)
    if not insp.has_table("social_communities"):
        return
    names = {c["name"] for c in insp.get_columns("social_communities")}
    if "cover_url" in names:
        return
    dialect = engine.dialect.name

    def run(sql: str) -> None:
        with engine.begin() as conn:
            conn.execute(text(sql))

    if dialect == "postgresql":
        run(
            "ALTER TABLE social_communities ADD COLUMN IF NOT EXISTS cover_url TEXT"
        )
    else:
        run("ALTER TABLE social_communities ADD COLUMN cover_url TEXT")


def _ensure_avatar_url_column(engine, table: str) -> None:
    insp = inspect(engine)
    if not insp.has_table(table):
        return
    names = {c["name"] for c in insp.get_columns(table)}
    if "avatar_url" in names:
        return
    dialect = engine.dialect.name

    def run(sql: str) -> None:
        with engine.begin() as conn:
            conn.execute(text(sql))

    if dialect == "postgresql":
        run(f"ALTER TABLE {table} ADD COLUMN IF NOT EXISTS avatar_url TEXT")
    else:
        run(f"ALTER TABLE {table} ADD COLUMN avatar_url TEXT")


def ensure_chat_entity_avatar_columns(engine) -> None:
    """avatar_url для groups, communities, channels (модели уже ожидают колонку)."""
    for table in ("groups", "communities", "channels"):
        _ensure_avatar_url_column(engine, table)


def ensure_bots_owner_id_column(engine) -> None:
    """owner_id на bots — владелец бота для загрузки игр."""
    insp = inspect(engine)
    if not insp.has_table("bots"):
        return
    names = {c["name"] for c in insp.get_columns("bots")}
    if "owner_id" in names:
        return
    dialect = engine.dialect.name

    def run(sql: str) -> None:
        with engine.begin() as conn:
            conn.execute(text(sql))

    if dialect == "postgresql":
        run("ALTER TABLE bots ADD COLUMN IF NOT EXISTS owner_id TEXT")
        run(
            "CREATE INDEX IF NOT EXISTS ix_bots_owner_id ON bots (owner_id)"
        )
    else:
        run("ALTER TABLE bots ADD COLUMN owner_id TEXT")


def ensure_channels_type_column(engine) -> None:
    insp = inspect(engine)
    if not insp.has_table("channels"):
        return
    names = {c["name"] for c in insp.get_columns("channels")}
    if "type" in names:
        return
    dialect = engine.dialect.name

    def run(sql: str) -> None:
        with engine.begin() as conn:
            conn.execute(text(sql))

    if dialect == "postgresql":
        run("ALTER TABLE channels ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'text'")
        run("UPDATE channels SET type = 'text' WHERE type IS NULL")
    else:
        run("ALTER TABLE channels ADD COLUMN type TEXT DEFAULT 'text'")
