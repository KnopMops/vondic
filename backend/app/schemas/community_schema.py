from app.core.extensions import ma
from app.models.community import Community
from app.schemas.user_schema import UserSchema


class CommunitySchema(ma.SQLAlchemyAutoSchema):
    class Meta:
        model = Community
        load_instance = True
        include_fk = True

    members_count = ma.Method("get_members_count")
    owner = ma.Nested(UserSchema, only=("id", "username", "avatar_url"))

    def get_members_count(self, obj):
        return len(obj.members)


community_schema = CommunitySchema()
communities_schema = CommunitySchema(many=True)
