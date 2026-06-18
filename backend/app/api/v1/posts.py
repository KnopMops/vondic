import hashlib
import os
import time
from datetime import datetime

from app.core.config import Config
from app.core.extensions import db
from app.models.notification import Notification
from app.models.user import User
from app.schemas.comment_schema import comment_schema, comments_schema
from app.schemas.post_schema import post_schema, posts_schema
from app.services.auth_service import AuthService
from app.services.comment_service import CommentService
from app.services.post_service import PostService
from app.utils.decorators import token_required
from flask import Blueprint, jsonify, request

posts_bp = Blueprint("posts", __name__, url_prefix="/api/v1/posts")


def _attach_author_to_post(post: dict) -> None:
    posted_by = post.get("posted_by")
    if not posted_by:
        return
    author = User.query.get(posted_by)
    if not author:
        return
    post["author_name"] = author.username
    post["author_avatar"] = author.avatar_url
    post["author_premium"] = bool(author.premium)
    post["author"] = {
        "id": author.id,
        "username": author.username,
        "avatar_url": author.avatar_url,
        "premium": bool(author.premium),
    }


def _optional_viewer():
    token = None
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        token = auth_header.split(" ", 1)[1].strip()
    if not token:
        token = request.cookies.get("access_token")
    if not token:
        return None
    user, error = AuthService.get_user_by_token(token)
    return user if not error else None


def _attach_authors_to_posts(items: list) -> None:
    author_ids = {p.get("posted_by") for p in items if p.get("posted_by")}
    if not author_ids:
        return
    authors = {
        u.id: u for u in User.query.filter(
            User.id.in_(author_ids)).all()}
    for post in items:
        author = authors.get(post.get("posted_by"))
        if not author:
            continue
        post["author_name"] = author.username
        post["author_avatar"] = author.avatar_url
        post["author_premium"] = bool(author.premium)
        post["author"] = {
            "id": author.id,
            "username": author.username,
            "avatar_url": author.avatar_url,
            "premium": bool(author.premium),
        }


def notify_all_users(
        title: str,
        message: str,
        notification_type: str = "system"):
    ts = int(time.time())
    users = User.query.filter(
        User.is_blocked == 0,
        User.status == 'online'
    ).all()
    for u in users:
        content_hash = hashlib.sha256(
            f"{u.id}|{message}|{ts}".encode("utf-8")
        ).hexdigest()
        existing = Notification.query.filter_by(
            user_id=u.id, notification_hash=content_hash
        ).first()

        if not existing:
            db.session.add(
                Notification(
                    user_id=u.id,
                    title=title,
                    type=notification_type,
                    message=message,
                    created_at=datetime.utcfromtimestamp(ts),
                    notification_hash=content_hash,
                )
            )
    db.session.commit()


@posts_bp.route("/", methods=["GET"])
def get_posts():
    page = request.args.get("page", 1, type=int)
    if page == 1:
        try:
            from app.services.removal_deadline_service import (
                enforce_removal_deadlines_throttled,
            )

            enforce_removal_deadlines_throttled()
        except Exception:
            pass
    per_page = request.args.get("per_page", 5, type=int)
    user_id = request.args.get("user_id", type=str)
    social_community_id = request.args.get("social_community_id", type=str)
    kind = (request.args.get("kind") or "").strip().lower()
    filter_mode = (request.args.get("filter") or "").strip().lower()
    is_blog = kind == "blog"

    if page < 1:
        page = 1
    if per_page < 1:
        per_page = 1
    if per_page > 50:
        per_page = 50

    pagination = PostService.get_posts_paginated(
        page=page,
        per_page=per_page,
        user_id=user_id,
        is_blog=is_blog,
        filter_mode=filter_mode,
        social_community_id=social_community_id or None,
    )
    items = posts_schema.dump(pagination.items)
    _attach_authors_to_posts(items)
    viewer = _optional_viewer()
    PostService.attach_like_flags(items, viewer.id if viewer else None)
    return jsonify(
        {
            "items": items,
            "total": pagination.total,
            "pages": pagination.pages,
            "page": pagination.page,
            "per_page": pagination.per_page,
        }
    ), 200


@posts_bp.route("/<post_id>", methods=["GET"])
def get_post(post_id):
    post = PostService.get_post_by_id(post_id)
    if not post:
        return jsonify({"error": "Пост не найден"}), 404
    data = post_schema.dump(post)
    _attach_author_to_post(data)
    viewer = _optional_viewer()
    PostService.attach_like_flags([data], viewer.id if viewer else None)
    return jsonify(data), 200


@posts_bp.route("/detail", methods=["POST"])
def get_post_detail():
    data = request.get_json() or {}
    post_id = data.get("post_id")

    if not post_id:
        return jsonify({"error": "Требуется post_id"}), 400

    post = PostService.get_post_by_id(post_id)
    if not post:
        return jsonify({"error": "Пост не найден"}), 404
    data = post_schema.dump(post)
    _attach_author_to_post(data)
    viewer = _optional_viewer()
    PostService.attach_like_flags([data], viewer.id if viewer else None)
    return jsonify(data), 200


@posts_bp.route("/", methods=["POST"])
@token_required
def create_post(current_user):
    data = request.get_json()
    if not data:
        return jsonify({"error": "Нет данных"}), 400

    attachments = data.get("attachments")
    if attachments is not None and not isinstance(attachments, list):
        return jsonify({"error": "attachments должен быть списком"}), 400

    is_blog = bool(data.get("is_blog"))
    content = data.get("content") or ""
    content_stripped = content.strip()

    if current_user.role == "Admin" and content_stripped:
        if content_stripped.startswith(
                "# ") or content_stripped.startswith("#"):
            is_blog = True

    if is_blog and current_user.role != "Admin":
        return jsonify({"error": "Неавторизовано"}), 403

    post = PostService.create_post(data, current_user.id, is_blog=is_blog)
    if not post:
        return jsonify({"error": "Не удалось создать пост"}), 500

    if is_blog:
        notify_all_users(
            title=current_user.username,
            message=post.content or "",
            notification_type="blog",
        )

    return jsonify(post_schema.dump(post)), 201


@posts_bp.route("/", methods=["PUT"])
@token_required
def update_post(current_user):
    data = request.get_json() or {}
    post_id = data.get("post_id")

    if not post_id:
        return jsonify({"error": "Требуется post_id"}), 400

    is_admin = current_user.role == "Admin"
    post, error = PostService.update_post(
        post_id, data, current_user.id, is_admin)
    if error:
        status_code = 404 if error == "Пост не найден" else 403
        return jsonify({"error": error}), status_code
    return jsonify(post_schema.dump(post)), 200


@posts_bp.route("/", methods=["DELETE"])
@token_required
def delete_post(current_user):
    data = request.get_json() or {}
    post_id = data.get("post_id")
    user_id = data.get("user_id")

    if not post_id or not user_id:
        return jsonify({"error": "Требуется post_id и user_id"}), 400

    if str(user_id) != str(current_user.id):
        return jsonify({"error": "Несоответствие ID пользователя"}), 403

    post, error = PostService.delete_post_by_user(post_id, user_id)
    if error:
        status_code = 404 if error == "Пост не найден" else 403
        return jsonify({"error": error}), status_code
    return jsonify({"message": "Пост успешно удалён"}), 200


@posts_bp.route("/admin", methods=["DELETE"])
@token_required
def delete_post_admin(current_user):
    if current_user.role != "Admin":
        return jsonify({"error": "Неавторизовано"}), 403

    data = request.get_json() or {}
    post_id = data.get("post_id")
    user_id = data.get("user_id")
    reason = data.get("reason")

    if not post_id or not user_id or not reason:
        return jsonify(
            {"error": "Требуется post_id, user_id и reason"}), 400

    if str(user_id) != str(current_user.id):
        return jsonify({"error": "Несоответствие ID пользователя"}), 403

    post, error = PostService.delete_post_by_admin(
        post_id, current_user.id, reason)
    if error:
        status_code = 404 if error == "Пост не найден" else 403
        return jsonify({"error": error}), status_code
    return jsonify({"message": "Пост удалён администратором"}), 200


@posts_bp.route("/like", methods=["POST"])
@token_required
def like_post(current_user):
    data = request.get_json() or {}
    post_id = data.get("post_id")
    if not post_id:
        return jsonify({"error": "Требуется post_id"}), 400

    post = PostService.like_post(post_id, current_user.id)
    return jsonify(post_schema.dump(post)), 200


@posts_bp.route("/unlike", methods=["POST"])
@token_required
def unlike_post(current_user):
    data = request.get_json() or {}
    post_id = data.get("post_id")
    if not post_id:
        return jsonify({"error": "Требуется post_id"}), 400

    post = PostService.unlike_post(post_id, current_user.id)
    return jsonify(post_schema.dump(post)), 200


@posts_bp.route("/<post_id>/comments", methods=["GET"])
def get_post_comments(post_id):
    comments = CommentService.get_comments_by_post(post_id)
    return jsonify(comments_schema.dump(comments)), 200


@posts_bp.route("/comment", methods=["POST"])
@token_required
def create_comment(current_user):
    data = request.get_json()
    if not data:
        return jsonify({"error": "Нет данных"}), 400

    post_id = data.get("post_id")
    if not post_id:
        return jsonify({"error": "Требуется post_id"}), 400

    comment, error = CommentService.create_comment(
        data, current_user.id, post_id)
    if error:
        return jsonify({"error": error}), 400

    return jsonify(comment_schema.dump(comment)), 201
