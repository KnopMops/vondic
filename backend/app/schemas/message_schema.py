from app.core.extensions import ma
from app.models.message import Message
from app.schemas.user_schema import UserSchema

class MessageSchema(ma.SQLAlchemyAutoSchema):
    class Meta:
        model = Message
        load_instance = True
        include_fk = True

    sender = ma.Nested(UserSchema, only=("id", "username", "avatar_url"))

message_schema = MessageSchema()
messages_schema = MessageSchema(many=True)
