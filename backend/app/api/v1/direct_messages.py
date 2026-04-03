from app.core.extensions import db
from app.schemas.message_schema import message_schema, messages_schema
from app.services.message_service import MessageService
from app.utils.decorators import token_required
from flask import Blueprint, jsonify, make_response, request

dm_bp = Blueprint("direct_messages", __name__, url_prefix="/api/v1/dm")

@dm_bp.route("/recent", methods=["GET", "OPTIONS"])
def get_recent_contacts():
    from app.services.auth_service import AuthService

    token = request.headers.get("Authorization", "").replace("Bearer ", "").strip()
    if not token:
        return jsonify({"error": "Требуется авторизация"}), 401

    current_user, error = AuthService.get_user_by_token(token)
    if error or not current_user:
        return jsonify({"error": "Не авторизовано"}), 401

    try:
        limit = request.args.get("limit", 30, type=int)
        if limit < 1:
            limit = 1
        if limit > 100:
            limit = 100
        contacts = MessageService.get_recent_contacts(current_user.id, limit=limit)
        return jsonify({"items": contacts}), 200
    except Exception as e:
        import traceback
        print(f"Error in get_recent_contacts: {e}")
        print(traceback.format_exc())
        return jsonify({"error": str(e)}), 500

@dm_bp.route("/<target_id>/messages", methods=["POST"])
@token_required
def send_dm(current_user, target_id):
    data = request.get_json() or {}
    message, error = MessageService.create_message(
        data, current_user.id, target_id=target_id
    )
    if error:
        return jsonify({"error": error}), 400

    from app.services.ollama_service import OllamaService

    ai_user = OllamaService.get_ai_user()
    if str(target_id) == str(ai_user.id):
        OllamaService.process_message_async(message.id, is_dm=True)

    return jsonify(message_schema.dump(message)), 201

@dm_bp.route("/<target_id>/messages", methods=["GET"])
@token_required
def get_dm_history(current_user, target_id):
    page = request.args.get("page", 1, type=int)
    per_page = request.args.get("per_page", 50, type=int)
    cursor = request.args.get("cursor", type=str)

    messages_pagination, error = MessageService.get_direct_messages(
        current_user.id, target_id, page, per_page, cursor
    )

    if error:
        return jsonify({"error": error}), 403

    items = messages_schema.dump(messages_pagination.items)

    next_cursor = None
    if items:
        last_item = items[-1]
        next_cursor = last_item.get("created_at")

    return jsonify(
        {
            "items": items,
            "total": messages_pagination.total,
            "pages": messages_pagination.pages,
            "page": messages_pagination.page,
            "next_cursor": next_cursor,
        }
    ), 200

@dm_bp.route("/<target_id>/messages/<message_id>", methods=["DELETE", "OPTIONS"])
def delete_message(target_id, message_id):
    from app.services.auth_service import AuthService
    from app.models.message import Message

    token = request.headers.get("Authorization", "").replace("Bearer ", "").strip()
    if not token:
        return jsonify({"error": "Требуется авторизация"}), 401

    current_user, error = AuthService.get_user_by_token(token)
    if error or not current_user:
        return jsonify({"error": "Не авторизовано"}), 401

    message = Message.query.filter(
        Message.id == message_id,
        (((Message.sender_id == current_user.id) & (
            Message.target_id == target_id)) | (
            (Message.sender_id == target_id) & (
                Message.target_id == current_user.id)))).first()

    if not message:
        return jsonify({"error": "Сообщение не найдено"}), 404

    if str(message.sender_id) != str(current_user.id):
        return jsonify({"error": "Доступ запрещён"}), 403

    message.content = "Сообщение удалено"
    message.attachments = []
    message.is_deleted = True
    db.session.commit()

    return jsonify({"message": "Сообщение успешно удалено"}), 200
