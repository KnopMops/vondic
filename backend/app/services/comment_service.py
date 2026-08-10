import html
from datetime import datetime

from app.core.extensions import db
from app.db_utils import db_commit
from app.exceptions import ConflictError, ForbiddenError, NotFoundError
from app.models.comment import Comment
from app.models.like import Like
from app.models.post import Post


class CommentService:
    @staticmethod
    def _sanitize_text(value):
        if value is None:
            return None
        if not isinstance(value, str):
            value = str(value)
        return html.escape(value.strip(), quote=False)

    @staticmethod
    def get_comments_by_post(post_id):
        return (
            Comment.query.filter_by(post_id=post_id, deleted=False)
            .order_by(Comment.created_at.asc())
            .all()
        )

    @staticmethod
    def get_comments_for_post(post_id, page=1, per_page=50, viewer_id=None):
        from sqlalchemy import or_
        query = Comment.query.filter_by(post_id=post_id).filter(
            or_(Comment.deleted.is_(False), Comment.deleted.is_(None))
        )
        p = int(page or 1)
        if p < 1:
            p = 1
        pp = int(per_page or 50)
        if pp < 1:
            pp = 50

        total = query.count()
        pages = (total + pp - 1) // pp if total > 0 else 1
        items = query.order_by(Comment.created_at.asc()).offset((p - 1) * pp).limit(pp).all()
        return items, total, p, pages


    @staticmethod
    def get_comment_by_id(comment_id):
        return Comment.query.filter_by(id=comment_id, deleted=False).first()

    @staticmethod
    def create_comment(data, user_id, post_id):
        post = Post.query.filter_by(id=post_id, deleted=False).first()
        if not post:
            raise NotFoundError("Пост не найден")

        parent_id = data.get("parent_id")
        if parent_id:
            parent_comment = Comment.query.filter_by(
                id=parent_id, deleted=False
            ).first()
            if not parent_comment:
                raise NotFoundError("Родительский комментарий не найден")

        new_comment = Comment(
            content=CommentService._sanitize_text(data.get("content")),
            posted_by=user_id,
            post_id=post_id,
            parent_id=parent_id,
        )
        db.session.add(new_comment)
        db_commit()
        return new_comment

    @staticmethod
    def update_comment(comment_id, data, user_id, is_admin=False):
        comment = Comment.query.filter_by(id=comment_id, deleted=False).first()
        if not comment:
            raise NotFoundError("Комментарий не найден")

        if comment.posted_by != user_id and not is_admin:
            raise ForbiddenError("Неавторизовано")

        if "content" in data:
            comment.content = CommentService._sanitize_text(data["content"])

        db_commit()
        return comment

    @staticmethod
    def delete_comment_by_user(comment_id, user_id):
        comment = Comment.query.filter_by(id=comment_id, deleted=False).first()
        if not comment:
            raise NotFoundError("Комментарий не найден")

        if comment.posted_by != user_id:
            raise ForbiddenError("Неавторизовано")

        comment.deleted = True
        comment.deleted_at = datetime.utcnow()
        comment.deleted_by = user_id

        db_commit()
        return comment

    @staticmethod
    def delete_comment_by_admin(comment_id, admin_id, reason=None):
        comment = Comment.query.filter_by(id=comment_id, deleted=False).first()
        if not comment:
            raise NotFoundError("Комментарий не найден")

        comment.deleted = True
        comment.deleted_at = datetime.utcnow()
        comment.deleted_by = admin_id
        comment.reason_for_deletion = reason

        db_commit()
        return comment

    @staticmethod
    def like_comment(comment_id, user_id):
        comment = Comment.query.filter_by(id=comment_id, deleted=False).first()
        if not comment:
            raise NotFoundError("Комментарий не найден")
        post = Post.query.filter_by(id=comment.post_id, deleted=False).first()
        if not post:
            raise NotFoundError("Пост не найден")

        existing_like = Like.query.filter_by(
            user_id=user_id, comment_id=comment_id
        ).first()
        if existing_like:
            raise ConflictError("Уже лайкнуто")

        new_like = Like(user_id=user_id, comment_id=comment_id)
        comment.likes += 1

        db.session.add(new_like)
        db_commit()
        return comment

    @staticmethod
    def unlike_comment(comment_id, user_id):
        comment = Comment.query.filter_by(id=comment_id, deleted=False).first()
        if not comment:
            raise NotFoundError("Комментарий не найден")
        post = Post.query.filter_by(id=comment.post_id, deleted=False).first()
        if not post:
            raise NotFoundError("Пост не найден")

        existing_like = Like.query.filter_by(
            user_id=user_id, comment_id=comment_id
        ).first()
        if not existing_like:
            raise ConflictError("Не лайкнуто")

        if comment.likes > 0:
            comment.likes -= 1

        db.session.delete(existing_like)
        db_commit()
        return comment
