from app.core.extensions import ma
from app.models.message import Message
from app.schemas.user_schema import UserSchema
from app.services.message_service import MessageService


class MessageSchema(ma.SQLAlchemyAutoSchema):
    class Meta:
        model = Message
        load_instance = True
        include_fk = True

    sender = ma.Nested(UserSchema, only=("id", "username", "avatar_url"))
    content = ma.Function(
        lambda obj: MessageService._decrypt_content(
            obj.content))


message_schema = MessageSchema()
messages_schema = MessageSchema(many=True)
