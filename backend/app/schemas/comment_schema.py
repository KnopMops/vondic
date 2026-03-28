from app.core.extensions import ma
from app.models.comment import Comment

class CommentSchema(ma.SQLAlchemyAutoSchema):
    class Meta:
        model = Comment
        load_instance = True
        include_fk = True

comment_schema = CommentSchema()
comments_schema = CommentSchema(many=True)
