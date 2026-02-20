import re
from pathlib import Path

from app import create_app
from app.core.extensions import db
from app.models.gift_catalog import GiftCatalog


def slugify(value: str) -> str:
    raw = (value or "").strip().lower()
    raw = re.sub(r"\s+", "_", raw)
    raw = re.sub(r"[^a-z0-9_]+", "", raw)
    return raw or "gift"


KNOWN_GIFTS = {
    "firework.png": {
        "id": "newyear_fireworks",
        "name": "Новогодний салют",
        "coin_price": 99,
        "icon": "Flame",
        "description": "Праздничное настроение на Новый год",
    },
    "bouquet.png": {
        "id": "valentine_heart",
        "name": "Валентинка",
        "coin_price": 39,
        "icon": "Heart",
        "description": "Для Дня святого Валентина",
    },
    "female_day.png": {
        "id": "womens_day_bouquet",
        "name": "Букет к 8 Марта",
        "coin_price": 89,
        "icon": "Flower",
        "description": "Поздравление к Международному женскому дню",
    },
    "Birthday.png": {
        "id": "birthday_cake",
        "name": "Торт на День Рождения",
        "coin_price": 149,
        "icon": "Gift",
        "description": "Сладкое поздравление",
    },
    "pumpkin.png": {
        "id": "halloween_pumpkin",
        "name": "Тыква на Хэллоуин",
        "coin_price": 59,
        "icon": "Flame",
        "description": "Атмосфера страшного праздника",
    },
    "egg.png": {
        "id": "easter_egg",
        "name": "Пасхальное яйцо",
        "coin_price": 49,
        "icon": "Gift",
        "description": "Праздничный символ Пасхи",
    },
    "present.png": {
        "id": "christmas_gift",
        "name": "Подарок на Рождество",
        "coin_price": 99,
        "icon": "Gift",
        "description": "Тёплые рождественские пожелания",
    },
    "knowledge.png": {
        "id": "knowledge_day_coffee",
        "name": "Кофе ко Дню знаний",
        "coin_price": 39,
        "icon": "Coffee",
        "description": "Энергия для новых свершений",
    },
    "crown.png": {
        "id": "anniversary_crown",
        "name": "Корона на юбилей",
        "coin_price": 199,
        "icon": "Crown",
        "description": "Особое признание в важный день",
    },
    "fire.png": {
        "id": "party_flame",
        "name": "Огонь на вечеринку",
        "coin_price": 29,
        "icon": "Flame",
        "description": "Заводная атмосфера праздника",
    },
    "partner.png": {
        "id": "partner_badge",
        "name": "Наш партнёр",
        "coin_price": 1999,
        "icon": "Crown",
        "description": "Особый знак поддержки проекта",
    },
    "star.png": {
        "id": "gold_star",
        "name": "Золотая звезда",
        "coin_price": 1999,
        "icon": "Star",
        "description": "Самая престижная награда",
    },
}


def build_entries(gifts_dir: Path):
    entries = []
    for file_path in sorted(gifts_dir.iterdir()):
        if not file_path.is_file():
            continue
        if file_path.suffix.lower() not in {".png", ".jpg", ".jpeg", ".webp"}:
            continue
        filename = file_path.name
        preset = KNOWN_GIFTS.get(filename)
        if preset:
            entry = dict(preset)
        else:
            stem = file_path.stem
            entry = {
                "id": slugify(stem),
                "name": stem.replace("_", " ").strip().capitalize() or "Подарок",
                "coin_price": 0,
                "icon": "Gift",
                "description": None,
            }
        entry["image_url"] = f"/static/gifts/{filename}"
        entry["total_supply"] = None
        entries.append(entry)
    return entries


def upsert_gifts(entries):
    created = 0
    updated = 0
    for entry in entries:
        gift = GiftCatalog.query.get(entry["id"])
        if gift:
            gift.image_url = entry["image_url"]
            if not gift.name:
                gift.name = entry["name"]
            if gift.coin_price in (None, 0) and entry["coin_price"] is not None:
                gift.coin_price = entry["coin_price"]
            if gift.icon is None and entry["icon"] is not None:
                gift.icon = entry["icon"]
            if gift.description is None and entry["description"] is not None:
                gift.description = entry["description"]
            if gift.total_supply is None and entry["total_supply"] is not None:
                gift.total_supply = entry["total_supply"]
            updated += 1
        else:
            db.session.add(GiftCatalog(**entry))
            created += 1
    db.session.commit()
    return created, updated


def main():
    repo_root = Path(__file__).resolve().parents[1]
    gifts_dir = repo_root / "frontend" / "static" / "gifts"
    if not gifts_dir.exists():
        raise SystemExit(f"Каталог не найден: {gifts_dir}")
    app = create_app()
    with app.app_context():
        db.create_all()
        entries = build_entries(gifts_dir)
        created, updated = upsert_gifts(entries)
        print(f"Создано: {created}, обновлено: {updated}")


if __name__ == "__main__":
    main()
