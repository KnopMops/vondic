from app.schemas.post_schema import posts_schema
from app.schemas.user_schema import users_schema
from app.services.post_service import PostService
from app.services.user_service import UserService
from app.utils.decorators import token_required
from flask import Blueprint, jsonify, request

search_bp = Blueprint("search", __name__, url_prefix="/api/v1/search")


@search_bp.route("/", methods=["POST"])
@token_required
def global_search(current_user):
    """
    Глобальный поиск
    ---
    tags:
      - Search
    parameters:
      - name: body
        in: body
        required: true
        schema:
          type: object
          properties:
            access_token:
              type: string
              required: true
            query:
              type: string
              required: true
              description: "@поиск_пользователя или #поиск_статьи"
    responses:
      200:
        description: Результаты поиска
        schema:
          type: object
          properties:
            type:
              type: string
              enum: [users, posts, unknown]
            results:
              type: array
      400:
        description: Не указан поисковый запрос
    """
    data = request.get_json() or {}
    query = data.get("query")

    if not query:
        return jsonify({"error": "query is required"}), 400

    query = query.strip()
    if not query:
        return jsonify({"results": [], "type": "empty"}), 200

    if query.startswith("@"):
        # Search Users
        search_term = query[1:]  # Strip @
        if not search_term:
             return jsonify({"results": [], "type": "users"}), 200
             
        users = UserService.search_users(search_term)
        return jsonify({
            "type": "users",
            "results": users_schema.dump(users)
        }), 200

    elif query.startswith("#"):
        # Search Posts
        search_term = query[1:]  # Strip #
        if not search_term:
             return jsonify({"results": [], "type": "posts"}), 200

        posts = PostService.search_posts(search_term)
        return jsonify({
            "type": "posts",
            "results": posts_schema.dump(posts)
        }), 200

    else:
        # Unknown prefix or plain search
        # For now, if no prefix, return empty or default?
        # User instruction was specific: @ for user, # for content
        # We can default to empty or maybe search both? 
        # "категорию он будет принимать access_token и query... @почта или имя пользователя... #поиск статьи"
        # It implies strict categorization.
        return jsonify({
            "type": "unknown",
            "message": "Start query with @ for users or # for posts",
            "results": []
        }), 200
