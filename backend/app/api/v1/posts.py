from app.schemas.comment_schema import comment_schema, comments_schema
from app.schemas.post_schema import post_schema, posts_schema
from app.services.comment_service import CommentService
from app.services.post_service import PostService
from app.utils.decorators import token_required
from flask import Blueprint, jsonify, request

posts_bp = Blueprint("posts", __name__, url_prefix="/api/v1/posts")


@posts_bp.route("/", methods=["GET"])
def get_posts():
    """
    Получить список всех постов
    ---
    tags:
      - Posts
    responses:
      200:
        description: Список постов
        schema:
          type: array
          items:
            type: object
            properties:
              id:
                type: integer
              title:
                type: string
              content:
                type: string
              author_id:
                type: integer
    """
    posts = PostService.get_all_posts()
    return jsonify(posts_schema.dump(posts)), 200


@posts_bp.route("/<post_id>", methods=["GET"])
def get_post(post_id):
    """
    Получить пост по ID
    ---
    tags:
      - Posts
    parameters:
      - name: post_id
        in: path
        type: string
        required: true
    responses:
      200:
        description: Данные поста
        schema:
          type: object
          properties:
            id:
              type: integer
            title:
              type: string
            content:
              type: string
      404:
        description: Пост не найден
    """
    post = PostService.get_post_by_id(post_id)
    if not post:
        return jsonify({"error": "Post not found"}), 404
    return jsonify(post_schema.dump(post)), 200


@posts_bp.route("/detail", methods=["POST"])
def get_post_detail():
    """
    Получить пост по ID (через body)
    ---
    tags:
      - Posts
    parameters:
      - name: body
        in: body
        required: true
        schema:
          type: object
          properties:
            post_id:
              type: string
              required: true
    responses:
      200:
        description: Данные поста
      400:
        description: Не указан post_id
      404:
        description: Пост не найден
    """
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
    """
    Создать новый пост
    ---
    tags:
      - Posts
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
            title:
              type: string
            content:
              type: string
            attachments:
              type: array
              items:
                type: object
    responses:
      201:
        description: Пост создан
      400:
        description: Ошибка создания
    """
    data = request.get_json()
    if not data:
        return jsonify({"error": "No data provided"}), 400

    attachments = data.get("attachments")
    if attachments is not None and not isinstance(attachments, list):
        return jsonify({"error": "attachments must be a list"}), 400

    post = PostService.create_post(data, current_user.id)
    if not post:
        return jsonify({"error": "Failed to create post"}), 500

    return jsonify(post_schema.dump(post)), 201


@posts_bp.route("/", methods=["PUT"])
@token_required
def update_post(current_user):
    """
    Обновить пост
    ---
    tags:
      - Posts
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
            post_id:
              type: string
              required: true
            title:
              type: string
            content:
              type: string
    responses:
      200:
        description: Пост обновлен
      400:
        description: Неверные параметры
      403:
        description: Нет прав
      404:
        description: Пост не найден
    """
    data = request.get_json()
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
    """
    Удалить свой пост (для обычного пользователя)
    ---
    tags:
      - Posts
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
            post_id:
              type: string
              required: true
            user_id:
              type: string
              required: true
    responses:
      200:
        description: Пост удален
      400:
        description: Неверные параметры
      403:
        description: Нет прав
      404:
        description: Пост не найден
    """
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
    """
    Удалить пост (для администратора)
    ---
    tags:
      - Posts
    security:
      - Bearer: []
    parameters:
      - name: body
        in: body
        required: true
        schema:
          type: object
          properties:
            post_id:
              type: string
              required: true
            user_id:
              type: string
              required: true
            reason:
              type: string
              description: Причина удаления
              required: true
    responses:
      200:
        description: Пост удален
      400:
        description: Неверные параметры
      403:
        description: Нет прав (не админ)
      404:
        description: Пост не найден
    """
    if current_user.role != "Admin":
        return jsonify({"error": "Unauthorized"}), 403

    data = request.get_json() or {}
    post_id = data.get("post_id")
    user_id = data.get("user_id")
    reason = data.get("reason")

    if not post_id or not user_id or not reason:
        return jsonify({"error": "post_id, user_id and reason are required"}), 400

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
    """
    Лайкнуть пост
    ---
    tags:
      - Posts
    security:
      - Bearer: []
    parameters:
      - name: body
        in: body
        required: true
        schema:
          type: object
          properties:
            post_id:
              type: string
              required: true
    responses:
      200:
        description: Лайк добавлен
      400:
        description: Неверные параметры или лайк уже существует
      404:
        description: Пост не найден
    """
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
    """
    Убрать лайк с поста
    ---
    tags:
      - Posts
    security:
      - Bearer: []
    parameters:
      - name: body
        in: body
        required: true
        schema:
          type: object
          properties:
            post_id:
              type: string
              required: true
    responses:
      200:
        description: Лайк убран
      400:
        description: Неверные параметры или лайк отсутствует
      404:
        description: Пост не найден
    """
    data = request.get_json() or {}
    post_id = data.get("post_id")
    if not post_id:
        return jsonify({"error": "post_id is required"}), 400

    post, error = PostService.unlike_post(post_id, current_user.id)
    if error:
        status_code = 404 if error == "Post not found" else 400
        return jsonify({"error": error}), status_code
    return jsonify(post_schema.dump(post)), 200


# Comments routes nested under posts
@posts_bp.route("/<post_id>/comments", methods=["GET"])
def get_post_comments(post_id):
    """
    Получить комментарии к посту
    ---
    tags:
      - Comments
    parameters:
      - name: post_id
        in: path
        type: string
        required: true
    responses:
      200:
        description: Список комментариев
        schema:
          type: array
          items:
            type: object
    """
    comments = CommentService.get_comments_by_post(post_id)
    return jsonify(comments_schema.dump(comments)), 200


@posts_bp.route("/comment", methods=["POST"])
@token_required
def create_comment(current_user):
    """
    Создать комментарий к посту
    ---
    tags:
      - Comments
    security:
      - Bearer: []
    parameters:
      - name: body
        in: body
        required: true
        schema:
          type: object
          properties:
            post_id:
              type: string
              required: true
            content:
              type: string
            parent_id:
              type: string
              description: ID родительского комментария (необязательно)
    responses:
      201:
        description: Комментарий создан
      400:
        description: Ошибка создания
    """
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
