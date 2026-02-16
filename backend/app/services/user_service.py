import secrets
from datetime import datetime

from app.core.extensions import db
from app.models.user import User
from sqlalchemy import or_
from sqlalchemy.exc import IntegrityError
from werkzeug.security import check_password_hash, generate_password_hash


class UserService:
    @staticmethod
    def get_all_users():
        return User.query.all()

    @staticmethod
    def get_user_by_id(user_id):
        return User.query.get(user_id)

    @staticmethod
    def get_user_by_email(email):
        return User.query.filter_by(email=email).first()

    @staticmethod
    def get_user_by_telegram_id(telegram_id):
        return User.query.filter_by(telegram_id=telegram_id).first()

    @staticmethod
    def search_users(query_str):
        if not query_str or "@telegram.bot" in query_str:
            return []

        search = f"%{query_str}%"
        return User.query.filter(
            or_(
                User.username.ilike(search),
                User.email.ilike(search)
            )
        ).filter(
            ~User.email.like("%@telegram.bot")
        ).all()

    @staticmethod
    def create_user(data):
        try:
            new_user = User(
                username=data.get("username"),
                email=data.get("email"),
                password_hash=data.get("password_hash"),
                role=data.get("role", "User"),
            )
            db.session.add(new_user)
            db.session.commit()
            return new_user
        except IntegrityError:
            db.session.rollback()
            return None

    @staticmethod
    def update_user(user_id, data, current_user):
        user = User.query.get(user_id)
        if not user:
            return None, "User not found"

        if user.id != current_user.id and current_user.role != "Admin":
            return None, "Unauthorized"

        if "username" in data:
            user.username = data["username"]
        if "avatar_url" in data:
            user.avatar_url = data["avatar_url"]
        if "profile_bg_theme" in data:
            user.profile_bg_theme = data.get("profile_bg_theme")
            if user.profile_bg_theme:
                user.profile_bg_gradient = None
                user.profile_bg_image = None
        if "profile_bg_gradient" in data and current_user.premium:
            user.profile_bg_gradient = data.get("profile_bg_gradient")
            if user.profile_bg_gradient:
                user.profile_bg_theme = None
                user.profile_bg_image = None
        if "profile_bg_image" in data and current_user.premium:
            user.profile_bg_image = data.get("profile_bg_image")
            if user.profile_bg_image:
                user.profile_bg_theme = None
                user.profile_bg_gradient = None

        if "status" in data:
            raw_status = str(data.get("status") or "").strip().lower()
            status_map = {
                "online": "Online",
                "offline": "Offline",
                "в сети": "Online",
                "не в сети": "Offline",
            }
            if raw_status in status_map:
                user.status = status_map[raw_status]
            else:
                return None, "Invalid status"

        if current_user.role == "Admin":
            if "role" in data:
                user.role = data["role"]
            if "premium" in data:
                user.premium = int(data["premium"])

        try:
            db.session.commit()
            return user, None
        except IntegrityError:
            db.session.rollback()
            return None, "Username already taken"
        except Exception as e:
            db.session.rollback()
            return None, str(e)

    @staticmethod
    def generate_link_key(user_id):
        user = User.query.get(user_id)
        if not user:
            return None, "User not found"

        try:
            key = "".join(secrets.choice("0123456789") for _ in range(6))
            user.link_key = key
            db.session.commit()
            return key, None
        except Exception as e:
            db.session.rollback()
            return None, str(e)

    @staticmethod
    def set_developer(user_id, enabled: bool):
        user = User.query.get(user_id)
        if not user:
            return None, "User not found"
        user.is_developer = 1 if enabled else 0
        if not enabled:
            user.api_key_hash = None
            user.api_key = None
        try:
            db.session.commit()
            return user, None
        except Exception as e:
            db.session.rollback()
            return None, str(e)

    @staticmethod
    def generate_api_key(user_id, rotate: bool = False):
        user = User.query.get(user_id)
        if not user:
            return None, "User not found"
        if user.api_key and not rotate:
            return user.api_key, None
        token = secrets.token_urlsafe(32)
        user.api_key_hash = generate_password_hash(token)
        user.api_key = token
        user.is_developer = 1
        try:
            db.session.commit()
            return token, None
        except Exception as e:
            db.session.rollback()
            return None, str(e)

    @staticmethod
    def get_api_key(user_id):
        user = User.query.get(user_id)
        if not user:
            return None, "User not found"
        return user.api_key, None

    @staticmethod
    def get_user_by_api_key(api_key):
        if not api_key:
            return None
        users = User.query.filter(User.api_key_hash.isnot(None)).all()
        for user in users:
            if user.api_key_hash and check_password_hash(user.api_key_hash, api_key):
                return user
        return None

    @staticmethod
    def block_user(user_id, admin_user):
        if not admin_user or admin_user.role != "Admin":
            return None, "Unauthorized"

        user = User.query.get(user_id)
        if not user:
            return None, "User not found"

        user.is_blocked = 1
        user.is_blocked_at = datetime.utcnow()
        user.blocked_by_admin = admin_user.username
        try:
            db.session.commit()
            return user, None
        except Exception as e:
            db.session.rollback()
            return None, str(e)

    @staticmethod
    def unblock_user(user_id, admin_user):
        if not admin_user or admin_user.role != "Admin":
            return None, "Unauthorized"

        user = User.query.get(user_id)
        if not user:
            return None, "User not found"

        user.is_blocked = 0
        user.is_blocked_at = None
        user.blocked_by_admin = None
        try:
            db.session.commit()
            return user, None
        except Exception as e:
            db.session.rollback()
            return None, str(e)
