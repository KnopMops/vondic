from app.core.rate_limiter import check_spam_protection, rate_limit
from app.schemas.post_schema import post_schema, posts_schema
from app.services.post_service import PostService
from app.utils.decorators import api_key_required
from flask import Blueprint, jsonify, request

public_posts_bp = Blueprint(
    "public_posts", __name__, url_prefix="/api/public/v1/posts")


@public_posts_bp.route("/", methods=["GET"])
def get_posts():
    try:
        page = request.args.get('page', 1, type=int)
        limit = request.args.get('limit', 20, type=int)
        offset = (page - 1) * limit

        posts = PostService.get_posts_paginated(limit=limit, offset=offset)
        total_count = PostService.get_all_posts().count()

        return jsonify({
            "posts": posts_schema.dump(posts),
            "pagination": {
                "page": page,
                "limit": limit,
                "total": total_count,
                "pages": (total_count + limit - 1) // limit
            }
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@public_posts_bp.route("/<post_id>", methods=["GET"])
def get_post(post_id):
    try:
        post = PostService.get_post_by_id(post_id)
        if not post:
            return jsonify({"error": "Post not found"}), 404

        if post.privacy != 'public':
            return jsonify({"error": "Access denied"}), 403

        return jsonify(post_schema.dump(post)), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@public_posts_bp.route("/", methods=["POST"])
@api_key_required
@rate_limit(limit=10, window=3600, per_user=True)
def create_post(current_user):
    try:
        data = request.get_json() or {}

        content = data.get('content')
        if not content:
            return jsonify({"error": "Content is required"}), 400

        is_spam, spam_reason = check_spam_protection(content)
        if is_spam:
            return jsonify({"error": f"Spam detected: {spam_reason}"}), 400

        privacy = data.get('privacy', 'public')
        allowed_privacy = ['public', 'friends', 'private']
        if privacy not in allowed_privacy:
            return jsonify(
                {"error": f"Privacy must be one of: {', '.join(allowed_privacy)}"}), 400

        post_data = {
            'user_id': current_user.id,
            'content': content,
            'privacy': privacy
        }

        if 'media_urls' in data:
            post_data['media_urls'] = data['media_urls']

        if 'location' in data:
            post_data['location'] = data['location']

        if 'tags' in data:
            post_data['tags'] = data['tags']

        post, error = PostService.create_post(post_data)
        if error:
            return jsonify({"error": error}), 400

        return jsonify(post_schema.dump(post)), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@public_posts_bp.route("/<post_id>", methods=["PUT"])
@api_key_required
@rate_limit(limit=20, window=3600, per_user=True)
def update_post(current_user, post_id):
    try:
        post = PostService.get_post_by_id(post_id)
        if not post:
            return jsonify({"error": "Post not found"}), 404

        if post.user_id != current_user.id:
            return jsonify({"error": "Access denied"}), 403

        data = request.get_json() or {}

        update_data = {}
        if 'content' in data:

            is_spam, spam_reason = check_spam_protection(data['content'])
            if is_spam:
                return jsonify({"error": f"Spam detected: {spam_reason}"}), 400
            update_data['content'] = data['content']
        if 'privacy' in data:
            allowed_privacy = ['public', 'friends', 'private']
            if data['privacy'] not in allowed_privacy:
                return jsonify(
                    {"error": f"Privacy must be one of: {', '.join(allowed_privacy)}"}), 400
            update_data['privacy'] = data['privacy']
        if 'media_urls' in data:
            update_data['media_urls'] = data['media_urls']
        if 'location' in data:
            update_data['location'] = data['location']
        if 'tags' in data:
            update_data['tags'] = data['tags']

        if not update_data:
            return jsonify({"error": "No fields to update"}), 400

        updated_post, error = PostService.update_post(post_id, update_data)
        if error:
            return jsonify({"error": error}), 400

        return jsonify(post_schema.dump(updated_post)), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@public_posts_bp.route("/<post_id>", methods=["DELETE"])
@api_key_required
def delete_post(current_user, post_id):
    try:
        post = PostService.get_post_by_id(post_id)
        if not post:
            return jsonify({"error": "Post not found"}), 404

        if post.user_id != current_user.id:
            return jsonify({"error": "Access denied"}), 403

        success, error = PostService.delete_post(post_id)
        if not success:
            return jsonify({"error": error}), 400

        return jsonify({"message": "Post deleted successfully"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@public_posts_bp.route("/<post_id>/like", methods=["POST"])
@api_key_required
def like_post(current_user, post_id):
    try:
        post = PostService.get_post_by_id(post_id)
        if not post:
            return jsonify({"error": "Post not found"}), 404

        if post.privacy != 'public' and post.user_id != current_user.id:
            return jsonify({"error": "Access denied"}), 403

        success, error = PostService.like_post(post_id, current_user.id)
        if not success:
            return jsonify({"error": error}), 400

        return jsonify({"message": "Post liked successfully"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@public_posts_bp.route("/<post_id>/unlike", methods=["POST"])
@api_key_required
def unlike_post(current_user, post_id):
    try:
        post = PostService.get_post_by_id(post_id)
        if not post:
            return jsonify({"error": "Post not found"}), 404

        if post.privacy != 'public' and post.user_id != current_user.id:
            return jsonify({"error": "Access denied"}), 403

        success, error = PostService.unlike_post(post_id, current_user.id)
        if not success:
            return jsonify({"error": error}), 400

        return jsonify({"message": "Post unliked successfully"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@public_posts_bp.route("/<post_id>/comments", methods=["GET"])
def get_post_comments(post_id):
    try:
        post = PostService.get_post_by_id(post_id)
        if not post:
            return jsonify({"error": "Post not found"}), 404

        if post.privacy != 'public':
            return jsonify({"error": "Access denied"}), 403

        page = request.args.get('page', 1, type=int)
        limit = request.args.get('limit', 20, type=int)
        offset = (page - 1) * limit

        comments = PostService.get_post_comments(
            post_id, limit=limit, offset=offset)
        total_count = PostService.get_post_comments_count(post_id)

        return jsonify({
            "comments": comments,
            "pagination": {
                "page": page,
                "limit": limit,
                "total": total_count,
                "pages": (total_count + limit - 1) // limit
            }
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
