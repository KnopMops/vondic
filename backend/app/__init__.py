from flasgger import Swagger
from flask import Flask
from sqlalchemy import text

from app.core.config import Config
from app.core.extensions import cors, db, ma, mail, migrate


def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)
    db.init_app(app)
    migrate.init_app(app, db)
    ma.init_app(app)

    allowed_origins = [
        "https://poisonously-beloved-fawn.cloudpub.ru",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5000"
    ]
    cors.init_app(app, resources={
                  r"/*": {"origins": allowed_origins}}, supports_credentials=True)

    mail.init_app(app)

    # Initialize Flasgger
    swagger_config = {
        "headers": [],
        "specs": [
            {
                "endpoint": "apispec",
                "route": "/apispec.json",
                "rule_filter": lambda rule: True,
                "model_filter": lambda tag: True,
            }
        ],
        "static_url_path": "/flasgger_static",
        "swagger_ui": True,
        "specs_route": "/docs/",
        "info": {
            "title": "Vondic Backend API",
            "description": "API документация для бэкенда Vondic",
            "version": "1.0.0",
        },
    }
    Swagger(app, config=swagger_config)

    # Import models to ensure they are registered
    from app import models  # noqa: F401

    with app.app_context():
        if db.engine.dialect.name == "sqlite":
            cols = db.session.execute(
                text("PRAGMA table_info(messages)")).fetchall()
            column_names = [c[1] for c in cols]
            if column_names and "attachments" not in column_names:
                db.session.execute(
                    text("ALTER TABLE messages ADD COLUMN attachments TEXT"))
                db.session.commit()
            # Ensure 'gifts' column exists on users table
            ucols = db.session.execute(
                text("PRAGMA table_info(users)")).fetchall()
            ucolumn_names = [c[1] for c in ucols]
            if ucolumn_names and "gifts" not in ucolumn_names:
                db.session.execute(
                    text("ALTER TABLE users ADD COLUMN gifts TEXT"))
                db.session.commit()
            # Ensure gifts catalog table exists and is seeded
            gc_cols = db.session.execute(
                text("PRAGMA table_info(gifts_catalog)")).fetchall()
            if not gc_cols:
                db.session.execute(text("""
                    CREATE TABLE gifts_catalog (
                        id TEXT PRIMARY KEY,
                        name TEXT NOT NULL,
                        coin_price INTEGER NOT NULL DEFAULT 0,
                        icon TEXT,
                        description TEXT
                    )
                """))
                # Seed initial gifts
                seed_items = [
                    ("newyear_fireworks", "Новогодний салют", 99,
                     "Flame", "Праздничное настроение на Новый год"),
                    ("valentine_heart", "Валентинка", 39,
                     "Heart", "Для Дня святого Валентина"),
                    ("womens_day_bouquet", "Букет к 8 Марта", 89, "Flower",
                     "Поздравление к Международному женскому дню"),
                    ("birthday_cake", "Торт на День Рождения",
                     149, "Gift", "Сладкое поздравление"),
                    ("halloween_pumpkin", "Тыква на Хэллоуин", 59,
                     "Flame", "Атмосфера страшного праздника"),
                    ("easter_egg", "Пасхальное яйцо", 49,
                     "Gift", "Праздничный символ Пасхи"),
                    ("christmas_gift", "Подарок на Рождество", 99,
                     "Gift", "Тёплые рождественские пожелания"),
                    ("knowledge_day_coffee", "Кофе ко Дню знаний",
                     39, "Coffee", "Энергия для новых свершений"),
                    ("anniversary_crown", "Корона на юбилей", 199,
                     "Crown", "Особое признание в важный день"),
                    ("party_flame", "Огонь на вечеринку", 29,
                     "Flame", "Заводная атмосфера праздника"),
                    ("partner_badge", "Наш партнёр", 1999,
                     "Crown", "Особый знак поддержки проекта"),
                    ("gold_star", "Золотая звезда", 1999,
                     "Star", "Самая престижная награда"),
                ]
                for item in seed_items:
                    db.session.execute(text("""
                        INSERT INTO gifts_catalog (id, name, coin_price, icon, description)
                        VALUES (:id, :name, :coin_price, :icon, :description)
                    """), {
                        "id": item[0],
                        "name": item[1],
                        "coin_price": item[2],
                        "icon": item[3],
                        "description": item[4],
                    })
                db.session.commit()
            comm_cols = db.session.execute(
                text("PRAGMA table_info(communities)")).fetchall()
            if not comm_cols:
                db.session.execute(text("""
                    CREATE TABLE communities (
                        id TEXT PRIMARY KEY,
                        name TEXT NOT NULL,
                        description TEXT,
                        invite_code TEXT UNIQUE,
                        owner_id TEXT NOT NULL,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                """))
                db.session.execute(text("""
                    CREATE TABLE community_members (
                        user_id TEXT NOT NULL,
                        community_id TEXT NOT NULL,
                        joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        PRIMARY KEY (user_id, community_id),
                        FOREIGN KEY(user_id) REFERENCES users(id),
                        FOREIGN KEY(community_id) REFERENCES communities(id)
                    )
                """))
                db.session.commit()
            ch_cols = db.session.execute(
                text("PRAGMA table_info(community_channels)")).fetchall()
            if not ch_cols:
                db.session.execute(text("""
                    CREATE TABLE community_channels (
                        id TEXT PRIMARY KEY,
                        community_id TEXT NOT NULL,
                        name TEXT NOT NULL,
                        description TEXT,
                        type TEXT NOT NULL DEFAULT 'text',
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                """))
                db.session.execute(text(
                    "CREATE UNIQUE INDEX IF NOT EXISTS uq_community_channel_name ON community_channels(community_id, name)"))
                db.session.commit()
            ch2_cols = db.session.execute(
                text("PRAGMA table_info(channels)")).fetchall()
            if not ch2_cols:
                db.session.execute(text("""
                    CREATE TABLE channels (
                        id TEXT PRIMARY KEY,
                        name TEXT NOT NULL,
                        description TEXT,
                        invite_code TEXT UNIQUE,
                        owner_id TEXT NOT NULL,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                """))
                db.session.execute(text("""
                    CREATE TABLE channel_participants (
                        user_id TEXT NOT NULL,
                        channel_id TEXT NOT NULL,
                        joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        PRIMARY KEY (user_id, channel_id),
                        FOREIGN KEY(user_id) REFERENCES users(id),
                        FOREIGN KEY(channel_id) REFERENCES channels(id)
                    )
                """))
                db.session.commit()
            missing = db.session.execute(text("""
                SELECT cc.id, cc.community_id, cc.name, cc.description
                FROM community_channels cc
                LEFT JOIN channels c ON c.id = cc.id
                WHERE c.id IS NULL
            """)).fetchall()
            for row in missing:
                cid = row[0]
                com_id = row[1]
                nm = row[2]
                desc = row[3]
                owner_row = db.session.execute(
                    text("SELECT owner_id FROM communities WHERE id = :cid"),
                    {"cid": com_id},
                ).fetchone()
                if not owner_row:
                    continue
                owner_id = owner_row[0]
                db.session.execute(text("""
                    INSERT INTO channels (id, name, description, owner_id, invite_code, created_at, updated_at)
                    VALUES (:id, :name, :description, :owner_id, substr(hex(randomblob(16)),1,8), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                """), {"id": cid, "name": nm, "description": desc, "owner_id": owner_id})
                members = db.session.execute(
                    text(
                        "SELECT user_id FROM community_members WHERE community_id = :cid"),
                    {"cid": com_id},
                ).fetchall()
                for m in members:
                    db.session.execute(text("""
                        INSERT OR IGNORE INTO channel_participants (user_id, channel_id, joined_at)
                        VALUES (:user_id, :channel_id, CURRENT_TIMESTAMP)
                    """), {"user_id": m[0], "channel_id": cid})
            if missing:
                db.session.commit()

            # Ensure AI user exists
            try:
                from app.services.ollama_service import OllamaService
                OllamaService.get_ai_user()
            except Exception as e:
                print(f"Failed to ensure AI user: {e}")

    from app.api.v1.auth import auth_bp
    from app.api.v1.channels import channels_bp
    from app.api.v1.comments import comments_bp
    from app.api.v1.communities import communities_bp
    from app.api.v1.direct_messages import dm_bp
    from app.api.v1.friends import friends_bp
    from app.api.v1.gifts import gifts_bp
    from app.api.v1.groups import groups_bp
    from app.api.v1.payments import payments_bp
    from app.api.v1.posts import posts_bp
    from app.api.v1.search import search_bp
    from app.api.v1.subscriptions import subscriptions_bp
    from app.api.v1.upload import upload_bp
    from app.api.v1.users import users_bp

    app.register_blueprint(users_bp)
    app.register_blueprint(auth_bp)
    app.register_blueprint(channels_bp)
    app.register_blueprint(groups_bp)
    app.register_blueprint(posts_bp)
    app.register_blueprint(comments_bp)
    app.register_blueprint(friends_bp)
    app.register_blueprint(subscriptions_bp)
    app.register_blueprint(search_bp)
    app.register_blueprint(upload_bp)
    app.register_blueprint(payments_bp)
    app.register_blueprint(gifts_bp)
    app.register_blueprint(communities_bp)
    app.register_blueprint(dm_bp)
    # Support API
    from app.api.v1.support import support_bp
    app.register_blueprint(support_bp)

    @app.route("/health")
    def health_check():
        return {"status": "ok", "service": "backend-core"}

    return app
