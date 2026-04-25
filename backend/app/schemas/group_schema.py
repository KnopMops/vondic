from app.core.extensions import ma
from app.models.group import Group
from app.schemas.user_schema import UserSchema


class GroupSchema(ma.SQLAlchemyAutoSchema):
    class Meta:
        model = Group
        load_instance = True
        include_fk = True

    participants_count = ma.Method("get_participants_count")
    owner = ma.Nested(UserSchema, only=("id", "username", "avatar_url"))

    def get_participants_count(self, obj):
        return len(obj.participants)


group_schema = GroupSchema()
groups_schema = GroupSchema(many=True)
