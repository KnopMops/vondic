import os
from datetime import datetime

from app.core.extensions import db
from app.models.post import Post
from app.models.user import User
from flask import current_app


class PostService:
    @staticmethod
    def get_all_posts():
        return (
            Post.query.filter_by(deleted=False).order_by(
                Post.created_at.desc()).all()
        )

    @staticmethod
    def get_post_by_id(post_id):
        return Post.query.filter_by(id=post_id, deleted=False).first()

    @staticmethod
    def search_posts(query_str):
        search = f"%{query_str}%"
        return Post.query.filter(
            Post.content.ilike(search),
            Post.deleted == False
        ).order_by(Post.created_at.desc()).all()

    @staticmethod
    def create_post(data, user_id):
        new_post = Post(
            content=data.get("content"),
            attachments=data.get("attachments"),
            posted_by=user_id,
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
            return None, "Post not found"

        if post.posted_by != user_id and not is_admin:
            return None, "Unauthorized"

        if "content" in data:
            post.content = data["content"]
        if "attachments" in data:
            post.attachments = data["attachments"]

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
            return None, "Post not found"

        existing_like = Like.query.filter_by(
            user_id=user_id, post_id=post_id).first()
        if existing_like:
            return None, "Already liked"

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
            return None, "Post not found"

        existing_like = Like.query.filter_by(
            user_id=user_id, post_id=post_id).first()
        if not existing_like:
            return None, "Not liked"

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
            return None, "Post not found"

        if post.posted_by != user_id:
            return None, "Unauthorized"

        freed_bytes = 0
        attachments = post.attachments or []
        for a in attachments:
            try:
                url = a.get("url")
                size = int(a.get("size") or 0)
                if url and isinstance(url, str):
                    abs_path = os.path.join(current_app.root_path, url.lstrip("/"))
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
                user.disk_usage = max(0, int(user.disk_usage or 0) - freed_bytes)
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
            return None, "Post not found"

        freed_bytes = 0
        attachments = post.attachments or []
        for a in attachments:
            try:
                url = a.get("url")
                size = int(a.get("size") or 0)
                if url and isinstance(url, str):
                    abs_path = os.path.join(current_app.root_path, url.lstrip("/"))
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
                user.disk_usage = max(0, int(user.disk_usage or 0) - freed_bytes)
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
