from app.core.extensions import ma
from app.models.social_community import SocialCommunity
from app.schemas.user_schema import UserSchema


class SocialCommunitySchema(ma.SQLAlchemyAutoSchema):
    class Meta:
        model = SocialCommunity
        load_instance = True
        include_fk = True

    members_count = ma.Method("get_members_count")
    owner = ma.Nested(UserSchema, only=("id", "username", "avatar_url"))

    def get_members_count(self, obj):
        return len(obj.members)


social_community_schema = SocialCommunitySchema()
social_communities_schema = SocialCommunitySchema(many=True)
