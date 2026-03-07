import importlib
import os

from flasgger import Swagger
from flask import Flask
from sqlalchemy import text

from app.core.config import Config
from app.core.extensions import cache, cors, db, ma, mail, migrate


def _tag_for_rule(rule: str) -> str:
    parts = [p for p in rule.split("/") if p]
    if len(parts) >= 3 and parts[0] == "api" and parts[1] == "v1":
        key = parts[2]
    elif parts:
        key = parts[0]
    else:
        key = "other"
    mapping = {
        "auth": "Auth",
        "users": "Users",
        "channels": "Channels",
        "groups": "Groups",
        "posts": "Posts",
        "comments": "Comments",
        "friends": "Friends",
        "subscriptions": "Subscriptions",
        "search": "Search",
        "upload": "Upload",
        "payments": "Payments",
        "gifts": "Gifts",
        "communities": "Communities",
        "dm": "Direct Messages",
        "storis": "Stories",
        "support": "Support",
        "health": "Health",
    }
    return mapping.get(key, key.replace("-", " ").title())


def _build_swagger_paths(app: Flask):
    paths = {}
    for rule in app.url_map.iter_rules():
        if rule.endpoint == "static":
            continue
        if rule.rule.startswith("/flasgger_static"):
            continue
        if rule.rule in ("/apispec.json", "/docs/"):
            continue
        methods = sorted(m for m in rule.methods if m not in {
                         "HEAD", "OPTIONS"})
        if not methods:
            continue
        view = app.view_functions.get(rule.endpoint)
        is_auth = bool(getattr(view, "_auth_required", False))
        tags = [_tag_for_rule(rule.rule)]
        if "/admin/" in rule.rule:
            tags.append("Admin")
        tags.append("Protected" if is_auth else "Public")
        entry = paths.setdefault(rule.rule, {})
        for method in methods:
            responses = {"200": {"description": "Success"}}
            if is_auth:
                responses["401"] = {"description": "Unauthorized"}
            entry[method.lower()] = {
                "summary": rule.endpoint,
                "tags": tags,
                "responses": responses,
            }
            if is_auth:
                entry[method.lower()]["security"] = [{"Bearer": []}]
    return paths


def _build_allowed_origins() -> list[str]:
    defaults = [
        "https://vondic.knopusmedia.ru",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5000",
        "http://localhost:1420",
        "http://127.0.0.1:1420",
        "tauri://localhost",
    ]
    raw = os.getenv("CORS_ALLOWED_ORIGINS", "")
    extra = [origin.strip() for origin in raw.split(",") if origin.strip()]
    frontend_url = os.getenv("FRONTEND_URL")
    if frontend_url:
        extra.append(frontend_url)
    merged = []
    seen = set()
    for origin in defaults + extra:
        if origin not in seen:
            merged.append(origin)
            seen.add(origin)
    return merged


def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)
    db.init_app(app)
    migrate.init_app(app, db)
    ma.init_app(app)
    cache.init_app(app)

    allowed_origins = _build_allowed_origins()
    cors.init_app(
        app,
        resources={r"/api/(?!public/).*": {"origins": allowed_origins}},
        supports_credentials=True,
    )

    mail.init_app(app)

    importlib.import_module("app.models")

    with app.app_context():
        if not os.environ.get("SKIP_DB_BOOTSTRAP"):
            # Очищаем любые незавершенные транзакции
            db.session.rollback()
            
            # PostgreSQL только
            def _pg_table_exists(table_name: str) -> bool:
                # Временно всегда возвращаем False для создания таблиц
                return False

            def _pg_column_exists(table_name: str, column_name: str) -> bool:
                return False

            # Добавляем колонки в messages таблицу
            if _pg_table_exists("messages"):
                message_columns = [
                    ("attachments", "JSON"),
                    ("pinned_by", "TEXT"),
                    ("reactions", "TEXT"),
                    ("is_read", "INTEGER DEFAULT 0"),
                    ("is_deleted", "INTEGER DEFAULT 0"),
                ]
                
                for column_name, column_def in message_columns:
                    try:
                        db.session.execute(
                            text(f"ALTER TABLE messages ADD COLUMN IF NOT EXISTS {column_name} {column_def}"))
                        db.session.commit()
                    except Exception:
                        db.session.rollback()

            # Добавляем колонки в users таблицу
            user_columns = [
                ("access_token", "TEXT"),
                ("refresh_token", "TEXT"),
                ("is_verified", "INTEGER DEFAULT 0"),
                ("socket_id", "TEXT"),
                ("is_blocked", "INTEGER DEFAULT 0"),
                ("is_blocked_at", "TIMESTAMP DEFAULT NULL"),
                ("blocked_by_admin", "TEXT"),
                ("role", "TEXT DEFAULT 'User'"),
                ("status", "TEXT DEFAULT 'offline'"),
                ("balance", "DOUBLE PRECISION DEFAULT 0.0"),
                ("premium", "INTEGER DEFAULT 0"),
                ("premium_started_at", "TIMESTAMP DEFAULT NULL"),
                ("premium_expired_at", "TIMESTAMP DEFAULT NULL"),
                ("disk_usage", "BIGINT DEFAULT 0"),
                ("is_messaging", "INTEGER DEFAULT 0"),
                ("telegram_id", "TEXT"),
                ("link_key", "TEXT"),
                ("two_factor_enabled", "INTEGER DEFAULT 0"),
                ("two_factor_method", "TEXT"),
                ("two_factor_secret", "TEXT"),
                ("two_factor_email_code", "TEXT"),
                ("two_factor_email_code_expires", "TIMESTAMP DEFAULT NULL"),
                ("login_alert_enabled", "INTEGER DEFAULT 0"),
                ("profile_bg_theme", "TEXT"),
                ("profile_bg_gradient", "TEXT"),
                ("profile_bg_image", "TEXT"),
                ("gifts", "TEXT"),
                ("storis", "TEXT"),
                ("is_developer", "INTEGER DEFAULT 0"),
                ("api_key_hash", "TEXT"),
                ("api_key", "TEXT"),
                ("cloud_password_hash", "TEXT"),
                ("cloud_password_reset_month", "INTEGER DEFAULT NULL"),
                ("cloud_password_reset_count", "INTEGER DEFAULT 0"),
                ("storage_bonus", "BIGINT DEFAULT 0"),
                ("video_channel_id", "TEXT"),
                ("video_subscribers", "INTEGER DEFAULT 0"),
                ("video_count", "INTEGER DEFAULT 0"),
                ("video_likes", "TEXT"),
                ("video_watch_later", "TEXT"),
                ("video_history", "TEXT"),
            ]
            
            for column_name, column_def in user_columns:
                try:
                    db.session.execute(
                        text(f"ALTER TABLE users ADD COLUMN IF NOT EXISTS {column_name} {column_def}"))
                    db.session.commit()
                except Exception:
                    db.session.rollback()

            # Добавляем колонки в posts таблицу
            post_columns = [
                ("is_blog", "BOOLEAN DEFAULT FALSE"),
                ("reports", "INTEGER DEFAULT 0"),
            ]
            
            for column_name, column_def in post_columns:
                try:
                    db.session.execute(
                        text(f"ALTER TABLE posts ADD COLUMN IF NOT EXISTS {column_name} {column_def}"))
                    db.session.commit()
                except Exception:
                    db.session.rollback()

            # Добавляем колонки в comments таблицу
            comment_columns = [
                ("deleted", "BOOLEAN DEFAULT FALSE"),
                ("deleted_by", "TEXT"),
                ("reason_for_deletion", "TEXT"),
                ("deleted_at", "TIMESTAMP DEFAULT NULL"),
                ("likes", "INTEGER DEFAULT 0"),
            ]
            
            for column_name, column_def in comment_columns:
                try:
                    db.session.execute(
                        text(f"ALTER TABLE comments ADD COLUMN IF NOT EXISTS {column_name} {column_def}"))
                    db.session.commit()
                except Exception:
                    db.session.rollback()

            # Создаем gifts_catalog таблицу
            try:
                db.session.execute(text("""
                    CREATE TABLE IF NOT EXISTS gifts_catalog (
                        id TEXT PRIMARY KEY,
                        name TEXT NOT NULL,
                        coin_price INTEGER NOT NULL DEFAULT 0,
                        icon TEXT,
                        description TEXT,
                        image_url TEXT,
                        total_supply INTEGER,
                        minted_count INTEGER NOT NULL
                    )
                """))
                db.session.commit()
            except Exception:
                db.session.rollback()
                
            # Добавляем подарки если таблица пуста
            try:
                count_result = db.session.execute(text("SELECT COUNT(*) FROM gifts_catalog")).scalar()
                if count_result == 0:
                    seed_items = [
                        ("newyear_fireworks", "Новогодний салют", 99, "Flame", "Праздничное настроение на Новый год"),
                        ("valentine_heart", "Валентинка", 39, "Heart", "Для Дня святого Валентина"),
                        ("womens_day_bouquet", "Букет к 8 Марта", 149, "Flower", "Милый букет для прекрасных дам"),
                        ("birthday_cake", "День рождения", 299, "Cake", "Поздравляем с днем рождения!"),
                        ("premium_crown", "Премиум корона", 999, "Crown", "Самая престижная награда"),
                    ]
                    
                    for item in seed_items:
                        db.session.execute(
                            text("""
                            INSERT INTO gifts_catalog (id, name, coin_price, icon, description, image_url, total_supply, minted_count)
                            VALUES (:id, :name, :coin_price, :icon, :description, :image_url, :total_supply, :minted_count)
                        """),
                            {
                                "id": item[0],
                                "name": item[1],
                                "coin_price": item[2],
                                "icon": item[3],
                                "description": item[4],
                                "image_url": None,
                                "total_supply": None,
                                "minted_count": 0,
                            },
                        )
                    db.session.commit()
            except Exception:
                db.session.rollback()

            # Создаем bots таблицу
            try:
                db.session.execute(text("""
                    CREATE TABLE IF NOT EXISTS bots (
                        id TEXT PRIMARY KEY,
                        name TEXT NOT NULL UNIQUE,
                        description TEXT,
                        avatar_url TEXT,
                        is_active INTEGER DEFAULT 1,
                        bot_token_hash TEXT,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                """))
                db.session.commit()
            except Exception:
                db.session.rollback()

            # Инициализируем support таблицы
            from app.api.v1.support import ensure_support_tables
            ensure_support_tables()

            # PostgreSQL миграции (остальной код)
            try:
                db.session.execute(
                    text(
                        "ALTER TABLE users ADD COLUMN IF NOT EXISTS storage_bonus BIGINT DEFAULT 0"
                    )
                )
                db.session.commit()
            except Exception:
                pass
            try:
                db.session.execute(
                    text("ALTER TABLE users ALTER COLUMN disk_usage TYPE BIGINT"))
                db.session.commit()
            except Exception:
                pass
            try:
                db.session.execute(
                    text("ALTER TABLE users ALTER COLUMN storage_bonus TYPE BIGINT"))
                db.session.commit()
            except Exception:
                pass
            try:
                db.session.execute(
                    text("ALTER TABLE bots ADD COLUMN IF NOT EXISTS bot_token_hash TEXT"))
                db.session.commit()
            except Exception:
                pass
            # Создаем communities таблицы
            try:
                db.session.execute(
                    text("""
                    CREATE TABLE IF NOT EXISTS communities (
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
                    CREATE TABLE IF NOT EXISTS community_members (
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
            except Exception:
                db.session.rollback()
                
            try:
                db.session.execute(
                    text("""
                    CREATE TABLE IF NOT EXISTS community_channels (
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
            except Exception:
                db.session.rollback()
                
            try:
                db.session.execute(
                    text("""
                    CREATE TABLE IF NOT EXISTS channels (
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
                    CREATE TABLE IF NOT EXISTS channel_participants (
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
            except Exception:
                db.session.rollback()
            
            # Временно отключаем проблемный код с JOIN
            # missing = db.session.execute(
            #     text("""
            #     SELECT cc.id, cc.community_id, cc.name, cc.description
            #     FROM community_channels cc
            #     LEFT JOIN channels c ON c.id = cc.id
            #     WHERE c.id IS NULL
            # """)
            # ).fetchall()
            # for row in missing:
            #     cid = row[0]
            #     com_id = row[1]
            #     nm = row[2]
            #     desc = row[3]
            #     owner_row = db.session.execute(
            #         text("SELECT owner_id FROM communities WHERE id = :cid"), {
            #             "cid": com_id}, ).fetchone()
            #     if not owner_row:
            #         continue
            #     owner_id = owner_row[0]
            #     db.session.execute(
            #         text("""
            #         INSERT INTO channels (id, name, description, owner_id, invite_code, created_at, updated_at)
            #         VALUES (:id, :name, :description, :owner_id, substr(md5(random()::text), 1, 8), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            #         ON CONFLICT (id) DO NOTHING
            #     """),
            #         {
            #             "id": cid,
            #             "name": nm,
            #             "description": desc,
            #             "owner_id": owner_id,
            #         },
            #     )
            #     members = db.session.execute(
            #         text("SELECT user_id FROM community_members WHERE community_id = :cid"), {
            #             "cid": com_id}, ).fetchall()
            #     for m in members:
            #         db.session.execute(
            #             text("""
            #             INSERT INTO channel_participants (user_id, channel_id, joined_at)
            #             VALUES (:user_id, :channel_id, CURRENT_TIMESTAMP)
            #             ON CONFLICT (user_id, channel_id) DO NOTHING
            #         """),
            #             {"user_id": m[0], "channel_id": cid},
            #         )
            # if missing:
            #     db.session.commit()

            try:
                from app.services.ollama_service import OllamaService

                OllamaService.get_ai_user()
            except Exception as e:
                print(f"Failed to ensure AI user: {e}")

    from app.api.public.v1.account import public_account_bp
    from app.api.public.v1.bots import public_bots_bp
    from app.api.public.v1.comments import public_comments_bp
    from app.api.public.v1.messages import public_messages_bp
    from app.api.public.v1.posts import public_posts_bp
    from app.api.public.v1.users import public_users_bp
    from app.api.v1.auth import auth_bp
    from app.api.v1.bots import bots_bp
    from app.api.v1.channels import channels_bp
    from app.api.v1.comments import comments_bp
    from app.api.v1.communities import communities_bp
    from app.api.v1.friends import friends_bp
    from app.api.v1.gifts import gifts_bp
    from app.api.v1.groups import groups_bp
    from app.api.v1.payments import payments_bp
    from app.api.v1.posts import posts_bp
    from app.api.v1.search import search_bp
    from app.api.v1.storis import storis_bp
    from app.api.v1.subscriptions import subscriptions_bp
    from app.api.v1.support import support_bp
    from app.api.v1.users import users_bp
    from app.api.v1.videos import videos_bp
    from app.api.v1.upload import upload_bp

    app.register_blueprint(public_account_bp)
    app.register_blueprint(public_bots_bp)
    app.register_blueprint(public_comments_bp)
    app.register_blueprint(public_messages_bp)
    app.register_blueprint(public_posts_bp)
    app.register_blueprint(public_users_bp)
    app.register_blueprint(auth_bp)
    app.register_blueprint(bots_bp)
    app.register_blueprint(channels_bp)
    app.register_blueprint(comments_bp)
    app.register_blueprint(communities_bp)
    app.register_blueprint(friends_bp)
    app.register_blueprint(gifts_bp)
    app.register_blueprint(groups_bp)
    app.register_blueprint(payments_bp)
    app.register_blueprint(posts_bp)
    app.register_blueprint(search_bp)
    app.register_blueprint(storis_bp)
    app.register_blueprint(subscriptions_bp)
    app.register_blueprint(support_bp)
    app.register_blueprint(users_bp)
    app.register_blueprint(videos_bp)
    app.register_blueprint(upload_bp)

    swagger_config = {
        "headers": [],
        "specs": [
            {
                "endpoint": 'apispec_json',
                "route": '/docs.json',
                "rule_filter": lambda rule: True,
                "model_filter": lambda tag: True,
            }
        ],
        "static_url_path": "/flasgger_static",
        "swagger_ui": True,
        "specs_route": "/docs/",
        "info": {
            "title": "Vondic API",
            "description": "API documentation for Vondic application",
            "version": "1.0",
            "contact": {
                "email": "support@vondic.com",
            },
        },
        "paths": _build_swagger_paths(app),
    }

    swagger = Swagger(app, config=swagger_config)

    @app.after_request
    def after_request(response):
        response.headers.add('Access-Control-Expose-Headers', 'X-Total-Count')
        return response

    return app
