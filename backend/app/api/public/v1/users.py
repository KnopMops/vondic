from app.core.rate_limiter import rate_limit
from app.schemas.user_schema import user_schema, users_schema
from app.services.user_service import UserService
from app.utils.decorators import token_required
from flask import Blueprint, jsonify, request

public_users_bp = Blueprint(
    "public_users", __name__, url_prefix="/api/public/v1/users")

@public_users_bp.route("/", methods=["GET"])
def get_users():
    try:
        page = request.args.get('page', 1, type=int)
        limit = request.args.get('limit', 20, type=int)
        offset = (page - 1) * limit

        users = UserService.get_public_users(limit=limit, offset=offset)
        total_count = UserService.get_public_users_count()

        return jsonify({
            "users": users_schema.dump(users),
            "pagination": {
                "page": page,
                "limit": limit,
                "total": total_count,
                "pages": (total_count + limit - 1) // limit
            }
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@public_users_bp.route("/<user_id>", methods=["GET"])
def get_user(user_id):
    try:
        user = UserService.get_user_by_id(user_id)
        if not user:
            return jsonify({"error": "User not found"}), 404

        user_data = user_schema.dump(user)

        restricted_fields = ['email', 'password_hash',
                             'api_key', 'refresh_token']
        for field in restricted_fields:
            user_data.pop(field, None)

        return jsonify(user_data), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@public_users_bp.route("/username/<username>", methods=["GET"])
def get_user_by_username(username):
    try:
        user = UserService.get_user_by_username(username)
        if not user:
            return jsonify({"error": "User not found"}), 404

        user_data = user_schema.dump(user)

        restricted_fields = ['email', 'password_hash',
                             'api_key', 'refresh_token']
        for field in restricted_fields:
            user_data.pop(field, None)

        return jsonify(user_data), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@public_users_bp.route("/search", methods=["GET"])
def search_users():
    try:
        query = request.args.get('q', '').strip()
        if not query:
            return jsonify({"error": "Query parameter 'q' is required"}), 400

        page = request.args.get('page', 1, type=int)
        limit = request.args.get('limit', 20, type=int)
        offset = (page - 1) * limit

        users = UserService.search_users(query, limit=limit, offset=offset)
        total_count = UserService.search_users_count(query)

        return jsonify({
            "users": users_schema.dump(users),
            "pagination": {
                "page": page,
                "limit": limit,
                "total": total_count,
                "pages": (total_count + limit - 1) // limit
            }
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@public_users_bp.route("/<user_id>/followers", methods=["GET"])
def get_user_followers(user_id):
    try:
        user = UserService.get_user_by_id(user_id)
        if not user:
            return jsonify({"error": "User not found"}), 404

        page = request.args.get('page', 1, type=int)
        limit = request.args.get('limit', 20, type=int)
        offset = (page - 1) * limit

        followers = UserService.get_user_followers(
            user_id, limit=limit, offset=offset)
        total_count = UserService.get_user_followers_count(user_id)

        return jsonify({
            "users": users_schema.dump(followers),
            "pagination": {
                "page": page,
                "limit": limit,
                "total": total_count,
                "pages": (total_count + limit - 1) // limit
            }
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@public_users_bp.route("/<user_id>/following", methods=["GET"])
def get_user_following(user_id):
    try:
        user = UserService.get_user_by_id(user_id)
        if not user:
            return jsonify({"error": "User not found"}), 404

        page = request.args.get('page', 1, type=int)
        limit = request.args.get('limit', 20, type=int)
        offset = (page - 1) * limit

        following = UserService.get_user_following(
            user_id, limit=limit, offset=offset)
        total_count = UserService.get_user_following_count(user_id)

        return jsonify({
            "users": users_schema.dump(following),
            "pagination": {
                "page": page,
                "limit": limit,
                "total": total_count,
                "pages": (total_count + limit - 1) // limit
            }
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@public_users_bp.route("/me", methods=["GET"])
@token_required
def get_current_user(current_user):
    try:
        user_data = user_schema.dump(current_user)

        restricted_fields = ['password_hash', 'api_key', 'refresh_token']
        for field in restricted_fields:
            user_data.pop(field, None)

        return jsonify(user_data), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@public_users_bp.route("/me", methods=["PUT"])
@token_required

@rate_limit(limit=20, window=3600, per_user=True)
def update_current_user(current_user):
    try:
        data = request.get_json() or {}

        update_data = {}
        if 'username' in data:
            update_data['username'] = data['username']
        if 'first_name' in data:
            update_data['first_name'] = data['first_name']
        if 'last_name' in data:
            update_data['last_name'] = data['last_name']
        if 'bio' in data:
            update_data['bio'] = data['bio']
        if 'avatar_url' in data:
            update_data['avatar_url'] = data['avatar_url']
        if 'website' in data:
            update_data['website'] = data['website']
        if 'location' in data:
            update_data['location'] = data['location']
        if 'privacy_settings' in data:
            update_data['privacy_settings'] = data['privacy_settings']

        if not update_data:
            return jsonify({"error": "No fields to update"}), 400

        updated_user, error = UserService.update_user(
            current_user.id, update_data)
        if error:
            return jsonify({"error": error}), 400

        user_data = user_schema.dump(updated_user)

        restricted_fields = ['password_hash', 'api_key', 'refresh_token']
        for field in restricted_fields:
            user_data.pop(field, None)

        return jsonify(user_data), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@public_users_bp.route("/<user_id>/follow", methods=["POST"])
@token_required

@rate_limit(limit=50, window=3600, per_user=True)
def follow_user(current_user, user_id):
    try:
        target_user = UserService.get_user_by_id(user_id)
        if not target_user:
            return jsonify({"error": "User not found"}), 404

        if current_user.id == target_user.id:
            return jsonify({"error": "Cannot follow yourself"}), 400

        success, error = UserService.follow_user(current_user.id, user_id)
        if not success:
            return jsonify({"error": error}), 400

        return jsonify({"message": "User followed successfully"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@public_users_bp.route("/<user_id>/unfollow", methods=["POST"])
@token_required

@rate_limit(limit=50, window=3600, per_user=True)
def unfollow_user(current_user, user_id):
    try:
        target_user = UserService.get_user_by_id(user_id)
        if not target_user:
            return jsonify({"error": "User not found"}), 404

        if current_user.id == target_user.id:
            return jsonify({"error": "Cannot unfollow yourself"}), 400

        success, error = UserService.unfollow_user(current_user.id, user_id)
        if not success:
            return jsonify({"error": error}), 400

        return jsonify({"message": "User unfollowed successfully"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
