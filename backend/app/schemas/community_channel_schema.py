from app.core.extensions import ma
from app.models.community_channel import CommunityChannel


class CommunityChannelSchema(ma.SQLAlchemyAutoSchema):
    class Meta:
        model = CommunityChannel
        load_instance = True
        include_fk = True


community_channel_schema = CommunityChannelSchema()
community_channels_schema = CommunityChannelSchema(many=True)
