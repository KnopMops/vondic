from app.core.extensions import ma
from app.models.friendship import Friendship

class FriendshipSchema(ma.SQLAlchemyAutoSchema):
    class Meta:
        model = Friendship
        load_instance = True
        include_fk = True

friendship_schema = FriendshipSchema()
