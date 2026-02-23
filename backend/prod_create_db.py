import os

from app import create_app
from app.core.config import Config
from app.core.extensions import db
from sqlalchemy import text

os.environ.pop("SKIP_DB_BOOTSTRAP", None)

db_path = os.path.join(Config.BASE_DIR, "database.db")

app = create_app()
with app.app_context():
    db.create_all()

    if db.engine.dialect.name == "sqlite":
        ucols = db.session.execute(text("PRAGMA table_info(users)")).fetchall()
        ucolumn_names = [c[1] for c in ucols]
        ensures = [
            ("ALTER TABLE users ADD COLUMN gifts TEXT", "gifts"),
            ("ALTER TABLE users ADD COLUMN storis TEXT", "storis"),
            ("ALTER TABLE users ADD COLUMN profile_bg_image TEXT", "profile_bg_image"),
            ("ALTER TABLE users ADD COLUMN blocked_by_admin TEXT", "blocked_by_admin"),
            (
                "ALTER TABLE users ADD COLUMN is_developer INTEGER DEFAULT 0",
                "is_developer",
            ),
            ("ALTER TABLE users ADD COLUMN api_key_hash TEXT", "api_key_hash"),
            ("ALTER TABLE users ADD COLUMN api_key TEXT", "api_key"),
            (
                "ALTER TABLE users ADD COLUMN cloud_password_hash TEXT",
                "cloud_password_hash",
            ),
            (
                "ALTER TABLE users ADD COLUMN cloud_password_reset_month INTEGER DEFAULT NULL",
                "cloud_password_reset_month",
            ),
            (
                "ALTER TABLE users ADD COLUMN cloud_password_reset_count INTEGER DEFAULT 0",
                "cloud_password_reset_count",
            ),
            (
                "ALTER TABLE users ADD COLUMN storage_bonus INTEGER DEFAULT 0",
                "storage_bonus",
            ),
            ("ALTER TABLE users ADD COLUMN video_channel_id TEXT", "video_channel_id"),
            (
                "ALTER TABLE users ADD COLUMN video_subscribers INTEGER DEFAULT 0",
                "video_subscribers",
            ),
            (
                "ALTER TABLE users ADD COLUMN video_count INTEGER DEFAULT 0",
                "video_count",
            ),
            ("ALTER TABLE users ADD COLUMN video_likes TEXT", "video_likes"),
            (
                "ALTER TABLE users ADD COLUMN video_watch_later TEXT",
                "video_watch_later",
            ),
            ("ALTER TABLE users ADD COLUMN video_history TEXT", "video_history"),
        ]
        for sql, col in ensures:
            if ucolumn_names and col not in ucolumn_names:
                db.session.execute(text(sql))
                db.session.commit()

        pcols = db.session.execute(text("PRAGMA table_info(posts)")).fetchall()
        pcolumn_names = [c[1] for c in pcols]
        if pcolumn_names and "is_blog" not in pcolumn_names:
            db.session.execute(
                text("ALTER TABLE posts ADD COLUMN is_blog INTEGER DEFAULT 0")
            )
            db.session.commit()

        gc_cols = db.session.execute(
            text("PRAGMA table_info(gifts_catalog)")
        ).fetchall()
        if not gc_cols:
            db.session.execute(
                text("""
                CREATE TABLE gifts_catalog (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    coin_price INTEGER NOT NULL DEFAULT 0,
                    icon TEXT,
                    description TEXT
                )
            """)
            )
            seed_items = [
                (
                    "newyear_fireworks",
                    "Новогодний салют",
                    99,
                    "Flame",
                    "Праздничное настроение на Новый год",
                ),
                (
                    "valentine_heart",
                    "Валентинка",
                    39,
                    "Heart",
                    "Для Дня святого Валентина",
                ),
                (
                    "womens_day_bouquet",
                    "Букет к 8 Марта",
                    89,
                    "Flower",
                    "Поздравление к Международному женскому дню",
                ),
                (
                    "birthday_cake",
                    "Торт на День Рождения",
                    149,
                    "Gift",
                    "Сладкое поздравление",
                ),
                (
                    "halloween_pumpkin",
                    "Тыква на Хэллоуин",
                    59,
                    "Flame",
                    "Атмосфера страшного праздника",
                ),
                (
                    "easter_egg",
                    "Пасхальное яйцо",
                    49,
                    "Gift",
                    "Праздничный символ Пасхи",
                ),
                (
                    "christmas_gift",
                    "Подарок на Рождество",
                    99,
                    "Gift",
                    "Тёплые рождественские пожелания",
                ),
                (
                    "knowledge_day_coffee",
                    "Кофе ко Дню знаний",
                    39,
                    "Coffee",
                    "Энергия для новых свершений",
                ),
                (
                    "anniversary_crown",
                    "Корона на юбилей",
                    199,
                    "Crown",
                    "Особое признание в важный день",
                ),
                (
                    "party_flame",
                    "Огонь на вечеринку",
                    29,
                    "Flame",
                    "Заводная атмосфера праздника",
                ),
                (
                    "partner_badge",
                    "Наш партнёр",
                    1999,
                    "Crown",
                    "Особый знак поддержки проекта",
                ),
                (
                    "gold_star",
                    "Золотая звезда",
                    1999,
                    "Star",
                    "Самая престижная награда",
                ),
            ]
            for item in seed_items:
                db.session.execute(
                    text("""
                    INSERT INTO gifts_catalog (id, name, coin_price, icon, description)
                    VALUES (:id, :name, :coin_price, :icon, :description)
                """),
                    {
                        "id": item[0],
                        "name": item[1],
                        "coin_price": item[2],
                        "icon": item[3],
                        "description": item[4],
                    },
                )
            db.session.commit()

        bot_cols = db.session.execute(
            text("PRAGMA table_info(bots)")).fetchall()
        bot_column_names = [c[1] for c in bot_cols]
        if not bot_cols:
            db.session.execute(
                text("""
                CREATE TABLE bots (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL UNIQUE,
                    description TEXT,
                    avatar_url TEXT,
                    is_active INTEGER DEFAULT 1,
                    bot_token_hash TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            )
            db.session.commit()
        if bot_column_names and "bot_token_hash" not in bot_column_names:
            db.session.execute(
                text("ALTER TABLE bots ADD COLUMN bot_token_hash TEXT"))
            db.session.commit()

        comm_cols = db.session.execute(
            text("PRAGMA table_info(communities)")
        ).fetchall()
        if not comm_cols:
            db.session.execute(
                text("""
                CREATE TABLE communities (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    description TEXT,
                    invite_code TEXT UNIQUE,
                    owner_id TEXT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            )
            db.session.execute(
                text("""
                CREATE TABLE community_members (
                    user_id TEXT NOT NULL,
                    community_id TEXT NOT NULL,
                    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    PRIMARY KEY (user_id, community_id),
                    FOREIGN KEY(user_id) REFERENCES users(id),
                    FOREIGN KEY(community_id) REFERENCES communities(id)
                )
            """)
            )
            db.session.commit()

        ch_cols = db.session.execute(
            text("PRAGMA table_info(community_channels)")
        ).fetchall()
        if not ch_cols:
            db.session.execute(
                text("""
                CREATE TABLE community_channels (
                    id TEXT PRIMARY KEY,
                    community_id TEXT NOT NULL,
                    name TEXT NOT NULL,
                    description TEXT,
                    type TEXT NOT NULL DEFAULT 'text',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            )
            db.session.execute(
                text(
                    "CREATE UNIQUE INDEX IF NOT EXISTS uq_community_channel_name ON community_channels(community_id, name)"
                )
            )
            db.session.commit()

        ch2_cols = db.session.execute(
            text("PRAGMA table_info(channels)")).fetchall()
        if not ch2_cols:
            db.session.execute(
                text("""
                CREATE TABLE channels (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    description TEXT,
                    invite_code TEXT UNIQUE,
                    owner_id TEXT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            )
            db.session.execute(
                text("""
                CREATE TABLE channel_participants (
                    user_id TEXT NOT NULL,
                    channel_id TEXT NOT NULL,
                    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    PRIMARY KEY (user_id, channel_id),
                    FOREIGN KEY(user_id) REFERENCES users(id),
                    FOREIGN KEY(channel_id) REFERENCES channels(id)
                )
            """)
            )
            db.session.commit()

        v_cols = db.session.execute(
            text("PRAGMA table_info(videos)")).fetchall()
        if not v_cols:
            db.session.execute(
                text("""
                CREATE TABLE videos (
                    id TEXT PRIMARY KEY,
                    author_id TEXT NOT NULL,
                    title TEXT NOT NULL,
                    description TEXT,
                    url TEXT NOT NULL,
                    poster TEXT,
                    duration INTEGER,
                    created_at TEXT,
                    updated_at TEXT,
                    views INTEGER DEFAULT 0,
                    likes INTEGER DEFAULT 0,
                    is_deleted INTEGER DEFAULT 0,
                    tags TEXT,
                    allow_comments INTEGER DEFAULT 1,
                    is_nsfw INTEGER DEFAULT 0,
                    has_profanity INTEGER DEFAULT 0,
                    is_published INTEGER DEFAULT 1
                )
            """)
            )
            db.session.commit()

        vv_cols = db.session.execute(
            text("PRAGMA table_info(video_views)")).fetchall()
        if not vv_cols:
            db.session.execute(
                text("""
                CREATE TABLE video_views (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    video_id TEXT NOT NULL,
                    user_id TEXT,
                    ip TEXT,
                    count INTEGER DEFAULT 0,
                    last_viewed_at TEXT
                )
            """)
            )
            db.session.execute(
                text(
                    "CREATE INDEX IF NOT EXISTS idx_video_views_vid ON video_views(video_id)"
                )
            )
            db.session.execute(
                text(
                    "CREATE INDEX IF NOT EXISTS idx_video_views_vid_ip ON video_views(video_id, ip)"
                )
            )
            db.session.commit()

    print("Production database schema ensured with all fields and supporting tables.")
