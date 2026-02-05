from app.core.extensions import ma
from app.models.user import User


class UserSchema(ma.SQLAlchemyAutoSchema):
    class Meta:
        model = User
        load_instance = True
        exclude = ("password_hash", "access_token", "refresh_token")


user_schema = UserSchema()
users_schema = UserSchema(many=True)
