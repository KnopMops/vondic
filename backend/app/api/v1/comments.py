from app.schemas.comment_schema import comment_schema
from app.services.comment_service import CommentService
from app.utils.decorators import token_required
from flask import Blueprint, jsonify, request

comments_bp = Blueprint("comments", __name__, url_prefix="/api/v1/comments")


@comments_bp.route("/", methods=["PUT"])
@token_required
def update_comment(current_user):
    """
    Обновить комментарий
    ---
    tags:
      - Comments
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
            comment_id:
              type: string
              required: true
            content:
              type: string
    responses:
      200:
        description: Комментарий обновлен
      400:
        description: Неверные параметры
      403:
        description: Нет прав
      404:
        description: Комментарий не найден
    """
    data = request.get_json()
    comment_id = data.get("comment_id")

    if not comment_id:
        return jsonify({"error": "comment_id is required"}), 400

    is_admin = current_user.role == "Admin"
    comment, error = CommentService.update_comment(
        comment_id, data, current_user.id, is_admin
    )
    if error:
        status_code = 404 if error == "Comment not found" else 403
        return jsonify({"error": error}), status_code
    return jsonify(comment_schema.dump(comment)), 200


@comments_bp.route("/", methods=["DELETE"])
@token_required
def delete_comment(current_user):
    """
    Удалить комментарий (Пользователь)
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
            comment_id:
              type: string
              required: true
            user_id:
              type: string
              required: true
    responses:
      200:
        description: Комментарий удален
      400:
        description: Неверные параметры
      403:
        description: Нет прав
      404:
        description: Комментарий не найден
    """
    data = request.get_json() or {}
    comment_id = data.get("comment_id")
    user_id = data.get("user_id")

    if not comment_id or not user_id:
        return jsonify({"error": "comment_id and user_id are required"}), 400

    if str(user_id) != str(current_user.id):
        return jsonify({"error": "User ID mismatch"}), 403

    comment, error = CommentService.delete_comment_by_user(comment_id, user_id)
    if error:
        status_code = 404 if error == "Comment not found" else 403
        return jsonify({"error": error}), status_code
    return jsonify({"message": "Comment deleted successfully"}), 200


@comments_bp.route("/admin", methods=["DELETE"])
@token_required
def delete_comment_admin(current_user):
    """
    Удалить комментарий (Админ)
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
            comment_id:
              type: string
              required: true
            user_id:
              type: string
              description: ID админа
              required: true
            reason:
              type: string
              required: true
    responses:
      200:
        description: Комментарий удален
      400:
        description: Неверные параметры
      403:
        description: Нет прав
      404:
        description: Комментарий не найден
    """
    if current_user.role != "Admin":
        return jsonify({"error": "Unauthorized"}), 403

    data = request.get_json() or {}
    comment_id = data.get("comment_id")
    user_id = data.get("user_id")
    reason = data.get("reason")

    if not comment_id or not user_id or not reason:
        return jsonify({"error": "comment_id, user_id and reason are required"}), 400

    if str(user_id) != str(current_user.id):
        return jsonify({"error": "User ID mismatch"}), 403

    comment, error = CommentService.delete_comment_by_admin(
        comment_id, current_user.id, reason
    )
    if error:
        status_code = 404 if error == "Comment not found" else 403
        return jsonify({"error": error}), status_code
    return jsonify({"message": "Comment deleted by admin successfully"}), 200


@comments_bp.route("/like", methods=["POST"])
@token_required
def like_comment(current_user):
    """
    Лайкнуть комментарий
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
            comment_id:
              type: string
              required: true
    responses:
      200:
        description: Лайк добавлен
      400:
        description: Неверные параметры
      404:
        description: Комментарий не найден
    """
    data = request.get_json() or {}
    comment_id = data.get("comment_id")
    if not comment_id:
        return jsonify({"error": "comment_id is required"}), 400

    comment, error = CommentService.like_comment(comment_id)
    if error:
        return jsonify({"error": error}), 404
    return jsonify(comment_schema.dump(comment)), 200


@comments_bp.route("/unlike", methods=["POST"])
@token_required
def unlike_comment(current_user):
    """
    Убрать лайк с комментария
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
            comment_id:
              type: string
              required: true
    responses:
      200:
        description: Лайк убран
      400:
        description: Неверные параметры
      404:
        description: Комментарий не найден
    """
    data = request.get_json() or {}
    comment_id = data.get("comment_id")
    if not comment_id:
        return jsonify({"error": "comment_id is required"}), 400

    comment, error = CommentService.unlike_comment(comment_id)
    if error:
        return jsonify({"error": error}), 404
    return jsonify(comment_schema.dump(comment)), 200
