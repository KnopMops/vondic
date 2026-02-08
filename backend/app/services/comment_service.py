from datetime import datetime

from app.core.extensions import db
from app.models.comment import Comment
from app.models.like import Like
from app.models.post import Post


class CommentService:
    @staticmethod
    def get_comments_by_post(post_id):
        return (
            Comment.query.filter_by(post_id=post_id, deleted=False)
            .order_by(Comment.created_at.asc())
            .all()
        )

    @staticmethod
    def get_comment_by_id(comment_id):
        return Comment.query.filter_by(id=comment_id, deleted=False).first()

    @staticmethod
    def create_comment(data, user_id, post_id):
        post = Post.query.filter_by(id=post_id, deleted=False).first()
        if not post:
            return None, "Post not found"

        parent_id = data.get("parent_id")
        if parent_id:
            parent_comment = Comment.query.filter_by(
                id=parent_id, deleted=False).first()
            if not parent_comment:
                return None, "Parent comment not found"

        new_comment = Comment(
            content=data.get("content"),
            posted_by=user_id,
            post_id=post_id,
            parent_id=parent_id
        )
        try:
            db.session.add(new_comment)
            db.session.commit()
            return new_comment, None
        except Exception as e:
            db.session.rollback()
            return None, str(e)

    @staticmethod
    def update_comment(comment_id, data, user_id, is_admin=False):
        comment = Comment.query.filter_by(id=comment_id, deleted=False).first()
        if not comment:
            return None, "Comment not found"

        if comment.posted_by != user_id and not is_admin:
            return None, "Unauthorized"

        if "content" in data:
            comment.content = data["content"]

        try:
            db.session.commit()
            return comment, None
        except Exception as e:
            db.session.rollback()
            return None, str(e)

    @staticmethod
    def delete_comment_by_user(comment_id, user_id):
        comment = Comment.query.filter_by(id=comment_id, deleted=False).first()
        if not comment:
            return None, "Comment not found"

        if comment.posted_by != user_id:
            return None, "Unauthorized"

        comment.deleted = True
        comment.deleted_at = datetime.utcnow()
        comment.deleted_by = user_id

        try:
            db.session.commit()
            return comment, None
        except Exception as e:
            db.session.rollback()
            return None, str(e)

    @staticmethod
    def delete_comment_by_admin(comment_id, admin_id, reason=None):
        comment = Comment.query.filter_by(id=comment_id, deleted=False).first()
        if not comment:
            return None, "Comment not found"

        comment.deleted = True
        comment.deleted_at = datetime.utcnow()
        comment.deleted_by = admin_id
        comment.reason_for_deletion = reason

        try:
            db.session.commit()
            return comment, None
        except Exception as e:
            db.session.rollback()
            return None, str(e)

    @staticmethod
    def like_comment(comment_id, user_id):
        comment = Comment.query.filter_by(id=comment_id, deleted=False).first()
        if not comment:
            return None, "Comment not found"

        existing_like = Like.query.filter_by(
            user_id=user_id, comment_id=comment_id).first()
        if existing_like:
            return None, "Already liked"

        new_like = Like(user_id=user_id, comment_id=comment_id)
        comment.likes += 1

        try:
            db.session.add(new_like)
            db.session.commit()
            return comment, None
        except Exception as e:
            db.session.rollback()
            return None, str(e)

    @staticmethod
    def unlike_comment(comment_id, user_id):
        comment = Comment.query.filter_by(id=comment_id, deleted=False).first()
        if not comment:
            return None, "Comment not found"

        existing_like = Like.query.filter_by(
            user_id=user_id, comment_id=comment_id).first()
        if not existing_like:
            return None, "Not liked"

        if comment.likes > 0:
            comment.likes -= 1

        try:
            db.session.delete(existing_like)
            db.session.commit()
            return comment, None
        except Exception as e:
            db.session.rollback()
            return None, str(e)
