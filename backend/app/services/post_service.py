import html
import os
from datetime import datetime

from app.core.extensions import db
from app.models.like import Like
from app.models.post import Post
from app.models.user import User
from flask import current_app

class PostService:
    @staticmethod
    def _sanitize_text(value):
        if value is None:
            return None
        if not isinstance(value, str):
            value = str(value)
        return html.escape(value.strip(), quote=True)

    @staticmethod
    def get_all_posts(is_blog: bool | None = False):
        return (
            Post.query.join(User, Post.posted_by == User.id)
            .filter(
                Post.deleted.is_(False),
                User.is_blocked == 0,
                Post.is_blog.is_(True) if is_blog else Post.is_blog.is_(False),
            )
            .order_by(Post.created_at.desc())
            .all()
        )

    @staticmethod
    def get_posts_paginated(
        page=1, per_page=5, user_id=None, is_blog: bool | None = False
    ):
        query = Post.query.join(User, Post.posted_by == User.id).filter(
            Post.deleted.is_(False),
            User.is_blocked == 0,
            Post.is_blog.is_(True) if is_blog else Post.is_blog.is_(False),
        )
        if user_id:
            query = query.filter(User.id == user_id)
        return query.order_by(Post.created_at.desc()).paginate(
            page=page, per_page=per_page, error_out=False
        )

    @staticmethod
    def get_post_by_id(post_id):
        return (
            Post.query.join(User, Post.posted_by == User.id)
            .filter(
                Post.id == post_id,
                Post.deleted.is_(False),
                User.is_blocked == 0,
            )
            .first()
        )

    @staticmethod
    def search_posts(query_str, is_blog: bool | None = False):
        search = f"%{query_str}%"
        return (
            Post.query.join(User, Post.posted_by == User.id)
            .filter(
                Post.content.ilike(search),
                Post.deleted.is_(False),
                User.is_blocked == 0,
                Post.is_blog.is_(True) if is_blog else Post.is_blog.is_(False),
            )
            .order_by(Post.created_at.desc())
            .all()
        )

    @staticmethod
    def create_post(data, user_id, is_blog: bool = False):
        new_post = Post(
            content=PostService._sanitize_text(data.get("content")),
            attachments=data.get("attachments"),
            posted_by=user_id,
            is_blog=is_blog,
        )
        try:
            db.session.add(new_post)
            db.session.commit()
            return new_post
        except Exception:
            db.session.rollback()
            return None

    @staticmethod
    def update_post(post_id, data, user_id, is_admin=False):
        post = Post.query.filter_by(id=post_id, deleted=False).first()
        if not post:
            return None, "Пост не найден"

        if post.posted_by != user_id and not is_admin:
            return None, "Неавторизовано"

        if "content" in data:
            post.content = PostService._sanitize_text(data["content"])
        if "attachments" in data:
            post.attachments = data["attachments"]
        if "is_blog" in data:
            if not is_admin:
                return None, "Неавторизовано"
            post.is_blog = bool(data["is_blog"])

        try:
            db.session.commit()
            return post, None
        except Exception as e:
            db.session.rollback()
            return None, str(e)

    @staticmethod
    def like_post(post_id, user_id):
        post = Post.query.filter_by(id=post_id, deleted=False).first()
        if not post:
            return None, "Пост не найден"
        if post.is_blog:
            return None, "Блог-пост только для чтения"

        existing_like = Like.query.filter_by(
            user_id=user_id, post_id=post_id).first()
        if existing_like:
            return None, "Уже лайкнуто"

        new_like = Like(user_id=user_id, post_id=post_id)
        if post.likes is None:
            post.likes = 0
        post.likes += 1

        try:
            db.session.add(new_like)
            db.session.commit()
            return post, None
        except Exception as e:
            db.session.rollback()
            return None, str(e)

    @staticmethod
    def unlike_post(post_id, user_id):
        post = Post.query.filter_by(id=post_id, deleted=False).first()
        if not post:
            return None, "Пост не найден"
        if post.is_blog:
            return None, "Блог-пост только для чтения"

        existing_like = Like.query.filter_by(
            user_id=user_id, post_id=post_id).first()
        if not existing_like:
            return None, "Не лайкнуто"

        if post.likes and post.likes > 0:
            post.likes -= 1

        try:
            db.session.delete(existing_like)
            db.session.commit()
            return post, None
        except Exception as e:
            db.session.rollback()
            return None, str(e)

    @staticmethod
    def delete_post_by_user(post_id, user_id):
        post = Post.query.filter_by(id=post_id, deleted=False).first()
        if not post:
            return None, "Пост не найден"

        if post.posted_by != user_id:
            return None, "Неавторизовано"

        freed_bytes = 0
        attachments = post.attachments or []
        for a in attachments:
            try:
                url = a.get("url")
                size = int(a.get("size") or 0)
                if url and isinstance(url, str):
                    abs_path = os.path.join(
                        current_app.root_path, url.lstrip("/"))
                    if os.path.exists(abs_path):
                        try:
                            os.remove(abs_path)
                        except Exception:
                            pass
                if size > 0:
                    freed_bytes += size
            except Exception:
                continue

        user = User.query.get(post.posted_by)
        if user and freed_bytes > 0:
            try:
                user.disk_usage = max(
                    0, int(user.disk_usage or 0) - freed_bytes)
            except Exception:
                pass

        post.deleted = True
        post.deleted_at = datetime.utcnow()
        post.deleted_by = user_id

        try:
            db.session.commit()
            return post, None
        except Exception as e:
            db.session.rollback()
            return None, str(e)

    @staticmethod
    def delete_post_by_admin(post_id, admin_id, reason=None):
        post = Post.query.filter_by(id=post_id, deleted=False).first()
        if not post:
            return None, "Пост не найден"

        freed_bytes = 0
        attachments = post.attachments or []
        for a in attachments:
            try:
                url = a.get("url")
                size = int(a.get("size") or 0)
                if url and isinstance(url, str):
                    abs_path = os.path.join(
                        current_app.root_path, url.lstrip("/"))
                    if os.path.exists(abs_path):
                        try:
                            os.remove(abs_path)
                        except Exception:
                            pass
                if size > 0:
                    freed_bytes += size
            except Exception:
                continue

        user = User.query.get(post.posted_by)
        if user and freed_bytes > 0:
            try:
                user.disk_usage = max(
                    0, int(user.disk_usage or 0) - freed_bytes)
            except Exception:
                pass

        post.deleted = True
        post.deleted_at = datetime.utcnow()
        post.deleted_by = admin_id
        post.reason_for_deletion = reason

        try:
            db.session.commit()
            return post, None
        except Exception as e:
            db.session.rollback()
            return None, str(e)
