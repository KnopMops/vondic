
from app.models.gift_catalog import GiftCatalog
from app.core.extensions import db
from app import create_app
import os
import sys
from pathlib import Path

BASE_DIR = Path(__file__).parent
sys.path.insert(0, str(BASE_DIR))


def force_setup():
    print("🔧 Принудительная настройка PostgreSQL...")

    app = create_app()

    with app.app_context():
        try:
            print("📋 Создаю таблицы через SQLAlchemy...")
            db.create_all()
            print("✅ SQLAlchemy таблицы созданы")
            print("🎁 Проверяю подарки по умолчанию...")
            default_gifts = [
                ("newyear_fireworks", "Новогодний салют", 99, "Flame", "Праздничное настроение на Новый год"),
                ("valentine_heart", "Валентинка", 39, "Heart", "Для Дня святого Валентина"),
                ("womens_day_bouquet", "Букет к 8 Марта", 149, "Flower", "Милый букет для прекрасных дам"),
                ("birthday_cake", "День рождения", 299, "Cake", "Поздравляем с днем рождения!"),
                ("premium_crown", "Премиум корона", 999, "Crown", "Самая престижная награда"),
            ]
            for gift in default_gifts:
                exists = GiftCatalog.query.filter_by(id=gift[0]).first()
                if exists:
                    continue
                db.session.add(
                    GiftCatalog(
                        id=gift[0],
                        name=gift[1],
                        coin_price=gift[2],
                        icon=gift[3],
                        description=gift[4],
                        image_url=None,
                        total_supply=None,
                        minted_count=0,
                    )
                )
            db.session.commit()
            print("✅ Подарки проверены")

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
