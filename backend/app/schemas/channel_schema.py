from app.core.extensions import ma
from app.models.channel import Channel
from app.schemas.user_schema import UserSchema


class ChannelSchema(ma.SQLAlchemyAutoSchema):
    class Meta:
        model = Channel
        load_instance = True
        include_fk = True

    participants_count = ma.Method("get_participants_count")
    owner = ma.Nested(UserSchema, only=("id", "username", "avatar_url"))

    def get_participants_count(self, obj):
        return len(obj.participants)


channel_schema = ChannelSchema()
channels_schema = ChannelSchema(many=True)
