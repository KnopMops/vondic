from app.core.rate_limiter import check_spam_protection, rate_limit
from app.schemas.comment_schema import comment_schema, comments_schema
from app.services.comment_service import CommentService
from app.services.post_service import PostService
from app.utils.decorators import api_key_required
from flask import Blueprint, jsonify, request

public_comments_bp = Blueprint(
    "public_comments", __name__, url_prefix="/api/public/v1/comments")


@public_comments_bp.route("/", methods=["GET"])
def get_comments():
    try:
        page = request.args.get('page', 1, type=int)
        limit = request.args.get('limit', 20, type=int)
        offset = (page - 1) * limit

        comments = CommentService.get_public_comments(
            limit=limit, offset=offset)
        total_count = CommentService.get_public_comments_count()

        return jsonify({
            "comments": comments_schema.dump(comments),
            "pagination": {
                "page": page,
                "limit": limit,
                "total": total_count,
                "pages": (total_count + limit - 1) // limit
            }
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@public_comments_bp.route("/<comment_id>", methods=["GET"])
def get_comment(comment_id):
    try:
        comment = CommentService.get_comment_by_id(comment_id)
        if not comment:
            return jsonify({"error": "Comment not found"}), 404

        post = PostService.get_post_by_id(comment.post_id)
        if not post or post.privacy != 'public':
            return jsonify({"error": "Access denied"}), 403

        return jsonify(comment_schema.dump(comment)), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@public_comments_bp.route("/", methods=["POST"])
@api_key_required
@rate_limit(limit=15, window=3600, per_user=True)
def create_comment(current_user):
    try:
        data = request.get_json() or {}

        post_id = data.get('post_id')
        content = data.get('content')

        if not post_id:
            return jsonify({"error": "Post ID is required"}), 400
        if not content:
            return jsonify({"error": "Content is required"}), 400

        is_spam, spam_reason = check_spam_protection(content)
        if is_spam:
            return jsonify({"error": f"Spam detected: {spam_reason}"}), 400

        post = PostService.get_post_by_id(post_id)
        if not post:
            return jsonify({"error": "Post not found"}), 404

        if post.privacy == 'private' and post.user_id != current_user.id:
            return jsonify({"error": "Access denied"}), 403
        elif post.privacy == 'friends' and not PostService.is_friend_of_post_owner(post.user_id, current_user.id):
            return jsonify({"error": "Access denied"}), 403

        comment_data = {
            'user_id': current_user.id,
            'post_id': post_id,
            'content': content
        }

        comment, error = CommentService.create_comment(comment_data)
        if error:
            return jsonify({"error": error}), 400

        return jsonify(comment_schema.dump(comment)), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@public_comments_bp.route("/<comment_id>", methods=["PUT"])
@api_key_required
@rate_limit(limit=10, window=3600, per_user=True)
def update_comment(current_user, comment_id):
    try:
        comment = CommentService.get_comment_by_id(comment_id)
        if not comment:
            return jsonify({"error": "Comment not found"}), 404

        if comment.user_id != current_user.id:
            return jsonify({"error": "Access denied"}), 403

        data = request.get_json() or {}

        update_data = {}
        if 'content' in data:

            is_spam, spam_reason = check_spam_protection(data['content'])
            if is_spam:
                return jsonify({"error": f"Spam detected: {spam_reason}"}), 400
            update_data['content'] = data['content']

        if not update_data:
            return jsonify({"error": "No fields to update"}), 400

        updated_comment, error = CommentService.update_comment(
            comment_id, update_data)
        if error:
            return jsonify({"error": error}), 400

        return jsonify(comment_schema.dump(updated_comment)), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@public_comments_bp.route("/<comment_id>", methods=["DELETE"])
@api_key_required
def delete_comment(current_user, comment_id):
    try:
        comment = CommentService.get_comment_by_id(comment_id)
        if not comment:
            return jsonify({"error": "Comment not found"}), 404

        if comment.user_id != current_user.id and comment.post.user_id != current_user.id:
            return jsonify({"error": "Access denied"}), 403

        success, error = CommentService.delete_comment(comment_id)
        if not success:
            return jsonify({"error": error}), 400

        return jsonify({"message": "Comment deleted successfully"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@public_comments_bp.route("/<comment_id>/like", methods=["POST"])
@api_key_required
def like_comment(current_user, comment_id):
    try:
        comment = CommentService.get_comment_by_id(comment_id)
        if not comment:
            return jsonify({"error": "Comment not found"}), 404

        post = PostService.get_post_by_id(comment.post_id)
        if not post or post.privacy != 'public':
            return jsonify({"error": "Access denied"}), 403

        success, error = CommentService.like_comment(
            comment_id, current_user.id)
        if not success:
            return jsonify({"error": error}), 400

        return jsonify({"message": "Comment liked successfully"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@public_comments_bp.route("/<comment_id>/unlike", methods=["POST"])
@api_key_required
def unlike_comment(current_user, comment_id):
    try:
        comment = CommentService.get_comment_by_id(comment_id)
        if not comment:
            return jsonify({"error": "Comment not found"}), 404

        post = PostService.get_post_by_id(comment.post_id)
        if not post or post.privacy != 'public':
            return jsonify({"error": "Access denied"}), 403

        success, error = CommentService.unlike_comment(
            comment_id, current_user.id)
        if not success:
            return jsonify({"error": error}), 400

        return jsonify({"message": "Comment unliked successfully"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@public_comments_bp.route("/post/<post_id>", methods=["GET"])
def get_comments_for_post(post_id):
    try:
        post = PostService.get_post_by_id(post_id)
        if not post:
            return jsonify({"error": "Post not found"}), 404

        if post.privacy != 'public':
            return jsonify({"error": "Access denied"}), 403

        page = request.args.get('page', 1, type=int)
        limit = request.args.get('limit', 20, type=int)
        offset = (page - 1) * limit

        comments = CommentService.get_comments_for_post(
            post_id, limit=limit, offset=offset)
        total_count = CommentService.get_comments_for_post_count(post_id)

        return jsonify({
            "comments": comments_schema.dump(comments),
            "pagination": {
                "page": page,
                "limit": limit,
                "total": total_count,
                "pages": (total_count + limit - 1) // limit
            }
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
