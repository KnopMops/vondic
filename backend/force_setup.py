
import os
import sys
from pathlib import Path

BASE_DIR = Path(__file__).parent
sys.path.insert(0, str(BASE_DIR))

from app import create_app
from app.core.extensions import db
from sqlalchemy import text

def force_setup():
    print("🔧 Принудительная настройка PostgreSQL...")

    app = create_app()

    with app.app_context():
        try:

            print("📋 Создаю таблицы через SQLAlchemy...")
            db.create_all()
            print("✅ SQLAlchemy таблицы созданы")

            print("➕ Добавляю колонки...")

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
                    db.session.execute(text(f"ALTER TABLE users ADD COLUMN IF NOT EXISTS {column_name} {column_def}"))
                    print(f"✅ Колонка users.{column_name} добавлена")
                except Exception as e:
                    print(f"⚠️ Колонка users.{column_name}: {e}")
                    db.session.rollback()

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
                        minted_count INTEGER NOT NULL DEFAULT 0
                    )
                """))
                print("✅ Таблица gifts_catalog создана")

                count = db.session.execute(text("SELECT COUNT(*) FROM gifts_catalog")).scalar()
                if count == 0:
                    gifts = [
                        ("newyear_fireworks", "Новогодний салют", 99, "Flame", "Праздничное настроение на Новый год"),
                        ("valentine_heart", "Валентинка", 39, "Heart", "Для Дня святого Валентина"),
                        ("womens_day_bouquet", "Букет к 8 Марта", 149, "Flower", "Милый букет для прекрасных дам"),
                        ("birthday_cake", "День рождения", 299, "Cake", "Поздравляем с днем рождения!"),
                        ("premium_crown", "Премиум корона", 999, "Crown", "Самая престижная награда"),
                    ]

                    for gift in gifts:
                        db.session.execute(text("""
                            INSERT INTO gifts_catalog (id, name, coin_price, icon, description, image_url, total_supply, minted_count)
                            VALUES (:id, :name, :coin_price, :icon, :description, :image_url, :total_supply, :minted_count)
                        """), {
                            "id": gift[0],
                            "name": gift[1],
                            "coin_price": gift[2],
                            "icon": gift[3],
                            "description": gift[4],
                            "image_url": None,
                            "total_supply": None,
                            "minted_count": 0
                        })
                    print("✅ Подарки добавлены")

                db.session.commit()
            except Exception as e:
                print(f"⚠️ Gifts каталог: {e}")
                db.session.rollback()

            try:
                db.session.execute(text("""
                    CREATE TABLE IF NOT EXISTS communities (
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
                    CREATE TABLE IF NOT EXISTS community_members (
                        user_id TEXT NOT NULL,
                        community_id TEXT NOT NULL,
                        joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        PRIMARY KEY (user_id, community_id)
                    )
                """))
                db.session.execute(text("""
                    CREATE TABLE IF NOT EXISTS community_channels (
                        id TEXT PRIMARY KEY,
                        community_id TEXT NOT NULL,
                        name TEXT NOT NULL,
                        description TEXT,
                        type TEXT NOT NULL DEFAULT 'text',
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                """))
                db.session.execute(text("""
                    CREATE TABLE IF NOT EXISTS channels (
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
                    CREATE TABLE IF NOT EXISTS channel_participants (
                        user_id TEXT NOT NULL,
                        channel_id TEXT NOT NULL,
                        joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        PRIMARY KEY (user_id, channel_id)
                    )
                """))
                print("✅ Communities таблицы созданы")
                db.session.commit()
            except Exception as e:
                print(f"⚠️ Communities: {e}")
                db.session.rollback()

            print("🎉 Настройка PostgreSQL завершена!")
            return True

        except Exception as e:
            print(f"❌ Ошибка: {e}")
            db.session.rollback()
            return False

if __name__ == "__main__":
    success = force_setup()
    if success:
        print("✅ Все готово к работе!")
    else:
        print("❌ Проверьте настройки")
