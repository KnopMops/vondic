import html
import os
from datetime import datetime

from app.core.extensions import db
from app.db_utils import db_commit
from app.exceptions import ConflictError, ForbiddenError, NotFoundError
from app.models.like import Like
from app.models.post import Post
from app.models.social_community import SocialCommunity
from app.models.subscription import Subscription
from app.models.user import User
from app.services.social_community_service import SocialCommunityService
from flask import current_app


class PostService:
    @staticmethod
    def _sanitize_text(value):
        if value is None:
            return None
        if not isinstance(value, str):
            value = str(value)
        return html.escape(value.strip(), quote=False)

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
            page=1,
            per_page=5,
            user_id=None,
            is_blog: bool | None = False,
            filter_mode: str | None = None,
            social_community_id: str | None = None):
        query = Post.query.join(User, Post.posted_by == User.id).filter(
            Post.deleted.is_(False),
            User.is_blocked == 0,
            Post.is_blog.is_(True) if is_blog else Post.is_blog.is_(False),
        )

        if social_community_id:
            query = query.filter(
                Post.social_community_id == social_community_id
            )
        elif filter_mode == "subscriptions" and user_id:
            from sqlalchemy import or_
            subscriptions = Subscription.query.filter_by(
                subscriber_id=user_id
            ).all()
            target_ids = [sub.target_id for sub in subscriptions]
            user_community_ids = [
                c.id for c in SocialCommunity.query.filter(
                    SocialCommunity.members.any(User.id == user_id)
                ).all()
            ]
            or_conditions = []
            if target_ids:
                or_conditions.append(User.id.in_(target_ids))
            if user_community_ids:
                or_conditions.append(Post.social_community_id.in_(user_community_ids))
            if or_conditions:
                query = query.filter(or_(*or_conditions))
            else:
                return Post.query.filter(Post.id.is_(None)).paginate(
                    page=page, per_page=per_page, error_out=False
                )
        else:
            query = query.filter(Post.social_community_id.is_(None))

        if user_id and filter_mode != "subscriptions":
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
        social_community_id = data.get("social_community_id")
        if social_community_id:
            community = SocialCommunity.query.get(social_community_id)
            user = User.query.get(user_id)
            if not community or not SocialCommunityService.user_is_member(
                community, user
            ):
                raise ForbiddenError("Нет доступа к сообществу")
            if str(community.owner_id) != str(user_id):
                raise ForbiddenError("Только администратор может публиковать записи в сообществе")
            is_blog = False

        new_post = Post(
            content=PostService._sanitize_text(data.get("content")),
            attachments=data.get("attachments"),
            posted_by=user_id,
            social_community_id=social_community_id,
            is_blog=is_blog,
        )
        db.session.add(new_post)
        db_commit()
        return new_post

    @staticmethod
    def update_post(post_id, data, user_id, is_admin=False):
        post = Post.query.filter_by(id=post_id, deleted=False).first()
        if not post:
            raise NotFoundError("Пост не найден")

        if post.posted_by != user_id and not is_admin:
            raise ForbiddenError("Неавторизовано")

        if "content" in data:
            post.content = PostService._sanitize_text(data["content"])
        if "attachments" in data:
            post.attachments = data["attachments"]
        if "is_blog" in data:
            if not is_admin:
                raise ForbiddenError("Неавторизовано")
            post.is_blog = bool(data["is_blog"])

        db_commit()
        return post

    @staticmethod
    def like_post(post_id, user_id):
        post = Post.query.filter_by(id=post_id, deleted=False).first()
        if not post:
            raise NotFoundError("Пост не найден")

        existing_like = Like.query.filter_by(
            user_id=user_id, post_id=post_id).first()
        if existing_like:
            raise ConflictError("Уже лайкнуто")

        new_like = Like(user_id=user_id, post_id=post_id)
        if post.likes is None:
            post.likes = 0
        post.likes += 1

        db.session.add(new_like)
        db_commit()
        return post

    @staticmethod
    def unlike_post(post_id, user_id):
        post = Post.query.filter_by(id=post_id, deleted=False).first()
        if not post:
            raise NotFoundError("Пост не найден")

        existing_like = Like.query.filter_by(
            user_id=user_id, post_id=post_id).first()
        if not existing_like:
            raise ConflictError("Не лайкнуто")

        if post.likes and post.likes > 0:
            post.likes -= 1

        db.session.delete(existing_like)
        db_commit()
        return post

    @staticmethod
    def attach_like_flags(posts: list, viewer_id: str | None) -> None:
        if not viewer_id or not posts:
            return
        post_ids = [p.get("id") for p in posts if p.get("id")]
        if not post_ids:
            return
        liked_rows = (
            Like.query.filter(
                Like.user_id == str(viewer_id),
                Like.post_id.in_(post_ids),
            )
            .with_entities(Like.post_id)
            .all()
        )
        liked_ids = {row[0] for row in liked_rows}
        for post in posts:
            post["is_liked"] = post.get("id") in liked_ids

    @staticmethod
    def delete_post_by_user(post_id, user_id):
        post = Post.query.filter_by(id=post_id, deleted=False).first()
        if not post:
            raise NotFoundError("Пост не найден")

        if post.posted_by != user_id:
            if post.social_community_id:
                community = SocialCommunity.query.get(post.social_community_id)
                if not community or str(community.owner_id) != str(user_id):
                    raise ForbiddenError("Неавторизовано")
            else:
                raise ForbiddenError("Неавторизовано")

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
                        except OSError:
                            pass
                if size > 0:
                    freed_bytes += size
            except (TypeError, ValueError, AttributeError):
                continue

        user = User.query.get(post.posted_by)
        if user and freed_bytes > 0:
            try:
                user.disk_usage = max(
                    0, int(user.disk_usage or 0) - freed_bytes)
            except (TypeError, ValueError):
                pass

        post.deleted = True
        post.deleted_at = datetime.utcnow()
        post.deleted_by = user_id

        db_commit()
        return post

    @staticmethod
    def delete_post_by_admin(post_id, admin_id, reason=None):
        post = Post.query.filter_by(id=post_id, deleted=False).first()
        if not post:
            raise NotFoundError("Пост не найден")

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
                        except OSError:
                            pass
                if size > 0:
                    freed_bytes += size
            except (TypeError, ValueError, AttributeError):
                continue

        user = User.query.get(post.posted_by)
        if user and freed_bytes > 0:
            try:
                user.disk_usage = max(
                    0, int(user.disk_usage or 0) - freed_bytes)
            except (TypeError, ValueError):
                pass

        post.deleted = True
        post.deleted_at = datetime.utcnow()
        post.deleted_by = admin_id
        post.reason_for_deletion = reason

        db_commit()
        return post
