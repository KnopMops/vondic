import hashlib
import os
import time

from sqlalchemy import text
from app.core.config import Config
from app.core.extensions import db
from app.models.user import User
from app.schemas.comment_schema import comment_schema, comments_schema
from app.schemas.post_schema import post_schema, posts_schema
from app.services.comment_service import CommentService
from app.services.post_service import PostService
from app.utils.decorators import token_required
from flask import Blueprint, jsonify, request

posts_bp = Blueprint("posts", __name__, url_prefix="/api/v1/posts")


def notify_all_users(
        title: str,
        message: str,
        notification_type: str = "system"):
    ts = int(time.time())
    users = User.query.filter(User.is_blocked == 0).all()
    for u in users:
        content_hash = hashlib.sha256(
            f"{u.id}|{message}|{ts}".encode("utf-8")
        ).hexdigest()
        db.session.execute(text("""
            INSERT INTO notifications (user_id, title, type, message, created_at, delivered, notification_hash) 
            VALUES (:user_id, :title, :type, :message, :created_at, :delivered, :notification_hash)
        """), {
            "user_id": u.id,
            "title": title,
            "type": notification_type,
            "message": message,
            "created_at": ts,
            "delivered": 0,
            "notification_hash": content_hash
        })
    db.session.commit()


@posts_bp.route("/", methods=["GET"])
def get_posts():
    page = request.args.get("page", 1, type=int)
    per_page = request.args.get("per_page", 5, type=int)
    user_id = request.args.get("user_id", type=str)
    kind = (request.args.get("kind") or "").strip().lower()
    is_blog = kind == "blog"

    if page < 1:
        page = 1
    if per_page < 1:
        per_page = 1
    if per_page > 50:
        per_page = 50

    pagination = PostService.get_posts_paginated(
        page=page, per_page=per_page, user_id=user_id, is_blog=is_blog
    )
    return jsonify(
        {
            "items": posts_schema.dump(pagination.items),
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
        return jsonify({"error": "Post not found"}), 404
    return jsonify(post_schema.dump(post)), 200


@posts_bp.route("/detail", methods=["POST"])
def get_post_detail():
    data = request.get_json() or {}
    post_id = data.get("post_id")

    if not post_id:
        return jsonify({"error": "post_id is required"}), 400

    post = PostService.get_post_by_id(post_id)
    if not post:
        return jsonify({"error": "Post not found"}), 404
    return jsonify(post_schema.dump(post)), 200


@posts_bp.route("/", methods=["POST"])
@token_required
def create_post(current_user):
    data = request.get_json()
    if not data:
        return jsonify({"error": "No data provided"}), 400

    attachments = data.get("attachments")
    if attachments is not None and not isinstance(attachments, list):
        return jsonify({"error": "attachments must be a list"}), 400

    is_blog = bool(data.get("is_blog"))
    if is_blog and current_user.role != "Admin":
        return jsonify({"error": "Unauthorized"}), 403

    post = PostService.create_post(data, current_user.id, is_blog=is_blog)
    if not post:
        return jsonify({"error": "Failed to create post"}), 500

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
        return jsonify({"error": "post_id is required"}), 400

    is_admin = current_user.role == "Admin"
    post, error = PostService.update_post(
        post_id, data, current_user.id, is_admin)
    if error:
        status_code = 404 if error == "Post not found" else 403
        return jsonify({"error": error}), status_code
    return jsonify(post_schema.dump(post)), 200


@posts_bp.route("/", methods=["DELETE"])
@token_required
def delete_post(current_user):
    data = request.get_json() or {}
    post_id = data.get("post_id")
    user_id = data.get("user_id")

    if not post_id or not user_id:
        return jsonify({"error": "post_id and user_id are required"}), 400

    if str(user_id) != str(current_user.id):
        return jsonify({"error": "User ID mismatch"}), 403

    post, error = PostService.delete_post_by_user(post_id, user_id)
    if error:
        status_code = 404 if error == "Post not found" else 403
        return jsonify({"error": error}), status_code
    return jsonify({"message": "Post deleted successfully"}), 200


@posts_bp.route("/admin", methods=["DELETE"])
@token_required
def delete_post_admin(current_user):
    if current_user.role != "Admin":
        return jsonify({"error": "Unauthorized"}), 403

    data = request.get_json() or {}
    post_id = data.get("post_id")
    user_id = data.get("user_id")
    reason = data.get("reason")

    if not post_id or not user_id or not reason:
        return jsonify(
            {"error": "post_id, user_id and reason are required"}), 400

    if str(user_id) != str(current_user.id):
        return jsonify({"error": "User ID mismatch"}), 403

    post, error = PostService.delete_post_by_admin(
        post_id, current_user.id, reason)
    if error:
        status_code = 404 if error == "Post not found" else 403
        return jsonify({"error": error}), status_code
    return jsonify({"message": "Post deleted by admin successfully"}), 200


@posts_bp.route("/like", methods=["POST"])
@token_required
def like_post(current_user):
    data = request.get_json() or {}
    post_id = data.get("post_id")
    if not post_id:
        return jsonify({"error": "post_id is required"}), 400

    post, error = PostService.like_post(post_id, current_user.id)
    if error:
        status_code = 404 if error == "Post not found" else 400
        return jsonify({"error": error}), status_code
    return jsonify(post_schema.dump(post)), 200


@posts_bp.route("/unlike", methods=["POST"])
@token_required
def unlike_post(current_user):
    data = request.get_json() or {}
    post_id = data.get("post_id")
    if not post_id:
        return jsonify({"error": "post_id is required"}), 400

    post, error = PostService.unlike_post(post_id, current_user.id)
    if error:
        status_code = 404 if error == "Post not found" else 400
        return jsonify({"error": error}), status_code
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
        return jsonify({"error": "No data provided"}), 400

    post_id = data.get("post_id")
    if not post_id:
        return jsonify({"error": "post_id is required"}), 400

    comment, error = CommentService.create_comment(
        data, current_user.id, post_id)
    if error:
        return jsonify({"error": error}), 400

    return jsonify(comment_schema.dump(comment)), 201
