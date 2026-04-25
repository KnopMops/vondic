import secrets

from app.core.extensions import db
from app.models.bot import Bot
from sqlalchemy import or_
from sqlalchemy.exc import IntegrityError
from werkzeug.security import check_password_hash, generate_password_hash


class BotService:
    @staticmethod
    def get_all_bots():
        return Bot.query.order_by(Bot.created_at.desc()).all()

    @staticmethod
    def get_active_bots():
        return (
            Bot.query.filter(Bot.is_active == 1).order_by(
                Bot.created_at.desc()).all()
        )

    @staticmethod
    def search_bots(query_str):
        if not query_str:
            return []
        search = f"%{query_str}%"
        return (
            Bot.query.filter(or_(Bot.name.ilike(search),
                             Bot.description.ilike(search)))
            .order_by(Bot.created_at.desc())
            .all()
        )

    @staticmethod
    def search_active_bots(query_str):
        if not query_str:
            return []
        search = f"%{query_str}%"
        return (
            Bot.query.filter(
                (Bot.is_active == 1)
                & (or_(Bot.name.ilike(search), Bot.description.ilike(search)))
            )
            .order_by(Bot.created_at.desc())
            .all()
        )

    @staticmethod
    def get_active_bot_by_id(bot_id):
        if not bot_id:
            return None
        return Bot.query.filter_by(id=bot_id, is_active=1).first()

    @staticmethod
    def get_active_bot_by_name(name):
        if not name:
            return None
        return Bot.query.filter_by(name=name, is_active=1).first()

    @staticmethod
    def create_bot(data):
        name = (data.get("name") or "").strip()
        if not name:
            return None, "name is required"
        existing = Bot.query.filter(Bot.name == name).first()
        if existing:
            return None, "Бот с таким именем уже существует"
        description = data.get("description")
        avatar_url = data.get("avatar_url")
        is_active = data.get("is_active")
        if isinstance(is_active, bool):
            is_active = 1 if is_active else 0
        elif is_active is not None:
            try:
                is_active = int(is_active)
            except Exception:
                is_active = None
        bot = Bot(
            name=name,
            description=description,
            avatar_url=avatar_url,
            is_active=is_active if is_active is not None else 1,
        )
        try:
            db.session.add(bot)
            db.session.commit()
            return bot, None
        except IntegrityError as e:
            db.session.rollback()
            error_text = str(getattr(e, "orig", e)).lower()
            if "bots_name_key" in error_text or "duplicate key value" in error_text:
                return None, "Бот с таким именем уже существует"
            return None, "Не удалось создать бота из-за конфликта данных"
        except Exception as e:
            db.session.rollback()
            return None, str(e)

    @staticmethod
    def generate_bot_token(bot_id):
        bot = Bot.query.get(bot_id)
        if not bot:
            return None, "Bot not found"
        token = secrets.token_urlsafe(32)
        bot.bot_token_hash = generate_password_hash(token)
        try:
            db.session.commit()
            return token, None
        except Exception as e:
            db.session.rollback()
            return None, str(e)

    @staticmethod
    def verify_bot_token(bot_id, token):
        if not bot_id or not token:
            return False
        bot = Bot.query.get(bot_id)
        if not bot or not bot.bot_token_hash:
            return False
        return check_password_hash(bot.bot_token_hash, token)
