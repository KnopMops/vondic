from app.core.extensions import db
from app.models.user import User
from sqlalchemy.exc import IntegrityError


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
    def update_user(user_id, data):
        user = User.query.get(user_id)
        if not user:
            return None

        if "username" in data:
            user.username = data["username"]
        if "is_blocked" in data:
            user.is_blocked = int(data["is_blocked"])

        try:
            db.session.commit()
            return user
        except IntegrityError:
            db.session.rollback()
            return None
