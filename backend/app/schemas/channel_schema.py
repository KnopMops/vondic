from app.core.extensions import ma
from app.models.channel import Channel
from app.schemas.user_schema import UserSchema

class ChannelSchema(ma.SQLAlchemyAutoSchema):
    class Meta:
        model = Channel
        load_instance = True
        include_fk = True

    participants_count = ma.Method("get_participants_count")
    community_id = ma.Method("get_community_id")
    owner = ma.Nested(UserSchema, only=("id", "username", "avatar_url"))

    def get_participants_count(self, obj):
        return len(obj.participants)

    def get_community_id(self, obj):
        community_channel = getattr(obj, "community_channel", None)
        return community_channel.community_id if community_channel else None

channel_schema = ChannelSchema()
channels_schema = ChannelSchema(many=True)
