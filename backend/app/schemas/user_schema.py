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
            "link_key",
            "api_key_hash",
            "api_key",
        )

    def get_avatar_url(self, obj):
        return None if obj.is_blocked else obj.avatar_url


user_schema = UserSchema()
users_schema = UserSchema(many=True)
