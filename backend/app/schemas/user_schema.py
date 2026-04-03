from app.core.extensions import ma
from app.models.user import User

class UserSchema(ma.SQLAlchemyAutoSchema):
    avatar_url = ma.Method("get_avatar_url")

    class Meta:
        model = User
        load_instance = True
        exclude = (
            "password_hash",
            "access_token",
            "refresh_token",
            "api_key_hash",
            "api_key",
        )

    def get_avatar_url(self, obj):
        return None if obj.is_blocked else obj.avatar_url

user_schema = UserSchema()

def safe_get_avatar_url(obj):
    try:
        return None if obj.is_blocked else obj.avatar_url
    except (AttributeError, TypeError):
        return obj.avatar_url if hasattr(obj, 'avatar_url') else None

class SafeUserSchema(ma.SQLAlchemyAutoSchema):
    avatar_url = ma.Method("get_avatar_url")

    class Meta:
        model = User
        load_instance = True
        exclude = (
            "password_hash",
            "access_token",
            "refresh_token",
            "api_key_hash",
            "api_key",
        )

    def get_avatar_url(self, obj):
        return safe_get_avatar_url(obj)

users_schema = SafeUserSchema(many=True)
