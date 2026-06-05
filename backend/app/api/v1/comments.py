from app.exceptions import ForbiddenError, ValidationError
from app.schemas.comment_schema import comment_schema
from app.services.comment_service import CommentService
from app.utils.decorators import token_required
from flask import Blueprint, jsonify, request

comments_bp = Blueprint("comments", __name__, url_prefix="/api/v1/comments")


@comments_bp.route("/", methods=["PUT"])
@token_required
def update_comment(current_user):
    data = request.get_json()
    comment_id = data.get("comment_id")

    if not comment_id:
        raise ValidationError("Требуется comment_id")

    is_admin = current_user.role == "Admin"
    comment = CommentService.update_comment(
        comment_id, data, current_user.id, is_admin
    )
    return jsonify(comment_schema.dump(comment)), 200


@comments_bp.route("/", methods=["DELETE"])
@token_required
def delete_comment(current_user):
    data = request.get_json() or {}
    comment_id = data.get("comment_id")
    user_id = data.get("user_id")

    if not comment_id or not user_id:
        raise ValidationError("Требуется comment_id и user_id")

    if str(user_id) != str(current_user.id):
        raise ForbiddenError("Несоответствие ID пользователя")

    CommentService.delete_comment_by_user(comment_id, user_id)
    return jsonify({"message": "Комментарий успешно удалён"}), 200


@comments_bp.route("/admin", methods=["DELETE"])
@token_required
def delete_comment_admin(current_user):
    if current_user.role != "Admin":
        raise ForbiddenError("Неавторизовано")

    data = request.get_json() or {}
    comment_id = data.get("comment_id")
    user_id = data.get("user_id")
    reason = data.get("reason")

    if not comment_id or not user_id or not reason:
        raise ValidationError("Требуется comment_id, user_id и reason")

    if str(user_id) != str(current_user.id):
        raise ForbiddenError("Несоответствие ID пользователя")

    CommentService.delete_comment_by_admin(comment_id, current_user.id, reason)
    return jsonify({"message": "Комментарий удалён администратором"}), 200


@comments_bp.route("/like", methods=["POST"])
@token_required
def like_comment(current_user):
    data = request.get_json() or {}
    comment_id = data.get("comment_id")
    if not comment_id:
        raise ValidationError("Требуется comment_id")

    comment = CommentService.like_comment(comment_id, current_user.id)
    return jsonify(comment_schema.dump(comment)), 200


@comments_bp.route("/unlike", methods=["POST"])
@token_required
def unlike_comment(current_user):
    data = request.get_json() or {}
    comment_id = data.get("comment_id")
    if not comment_id:
        raise ValidationError("Требуется comment_id")

    comment = CommentService.unlike_comment(comment_id, current_user.id)
    return jsonify(comment_schema.dump(comment)), 200
