from app.core.extensions import ma
from app.models.post import Post

class PostSchema(ma.SQLAlchemyAutoSchema):
    class Meta:
        model = Post
        load_instance = True
        include_fk = True

    comments_count = ma.Method("get_comments_count")

    def get_comments_count(self, obj):
        return len([c for c in obj.comments if not c.deleted]
                   ) if obj.comments else 0

post_schema = PostSchema()
posts_schema = PostSchema(many=True)
