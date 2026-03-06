from app.schemas.group_schema import group_schema, groups_schema
from app.schemas.message_schema import message_schema, messages_schema
from app.services.group_service import GroupService
from app.services.message_service import MessageService
from app.utils.decorators import token_required
from flask import Blueprint, jsonify, request

groups_bp = Blueprint("groups", __name__, url_prefix="/api/v1/groups")


@groups_bp.route("/", methods=["POST"])
@token_required
def create_group(current_user):
    data = request.get_json() or {}
    group, error = GroupService.create_group(data, current_user.id)
    if error:
        return jsonify({"error": error}), 400
    return jsonify(group_schema.dump(group)), 201


@groups_bp.route("/join", methods=["POST"])
@token_required
def join_group(current_user):
    data = request.get_json() or {}
    invite_code = data.get("invite_code")

    if not invite_code:
        return jsonify({"error": "invite_code is required"}), 400

    group, error = GroupService.join_group(invite_code, current_user.id)
    if error:
        return jsonify({"error": error}), 400
    return jsonify(group_schema.dump(group)), 200


@groups_bp.route("/my", methods=["POST"])
@token_required
def get_my_groups(current_user):
    groups = GroupService.get_user_groups(current_user.id)
    return jsonify(groups_schema.dump(groups)), 200


@groups_bp.route("/info", methods=["POST"])
@token_required
def get_group(current_user):
    data = request.get_json() or {}
    group_id = data.get("group_id")

    if not group_id:
        return jsonify({"error": "group_id is required"}), 400

    group = GroupService.get_group_by_id(group_id)
    if not group:
        return jsonify({"error": "Group not found"}), 404
    return jsonify(group_schema.dump(group)), 200


@groups_bp.route("/<group_id>/participants", methods=["GET", "POST"])
@token_required
def participants(current_user, group_id):
    if request.method == "GET":
        group = GroupService.get_group_by_id(group_id)
        if not group:
            return jsonify({"error": "Group not found"}), 404
        from app.schemas.user_schema import users_schema

        return jsonify(users_schema.dump(group.participants)), 200

    data = request.get_json() or {}
    target_user_id = data.get("user_id")

    if not target_user_id:
        return jsonify({"error": "user_id is required"}), 400

    group, error = GroupService.add_participant(
        group_id, target_user_id, current_user.id
    )
    if error:
        status_code = 403 if "Only owner" in error else 400
        return jsonify({"error": error}), status_code

    return jsonify(group_schema.dump(group)), 200


@groups_bp.route("/<group_id>/messages", methods=["POST"])
@token_required
def send_message(current_user, group_id):
    data = request.get_json() or {}
    message, error = MessageService.create_message(
        data, current_user.id, group_id)
    if error:
        return jsonify({"error": error}), 400
    return jsonify(message_schema.dump(message)), 201


@groups_bp.route("/<group_id>/messages", methods=["GET"])
@token_required
def get_messages(current_user, group_id):
    page = request.args.get("page", 1, type=int)
    per_page = request.args.get("per_page", 50, type=int)
    cursor = request.args.get("cursor", type=str)

    messages_pagination, error = MessageService.get_group_messages(
        group_id, current_user.id, page, per_page, cursor
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


@groups_bp.route("/<group_id>/messages/<message_id>", methods=["DELETE"])
@token_required
def delete_group_message(current_user, group_id, message_id):
    from app.models.group import Group
    from app.models.message import Message

    # Check if user is in the group
    group = Group.query.get(group_id)
    if not group or current_user not in group.participants:
        return jsonify({"error": "Group not found or access denied"}), 403

    # Check if message belongs to this group
    message = Message.query.filter(
        Message.id == message_id,
        Message.group_id == group_id
    ).first()

    if not message:
        return jsonify({"error": "Message not found"}), 404

    if str(message.sender_id) != str(current_user.id):
        return jsonify({"error": "Forbidden"}), 403

    # Mark message as deleted
    message.content = "Сообщение удалено"
    message.attachments = []
    if hasattr(message, 'is_deleted'):
        message.is_deleted = True
    else:
        # If the field doesn't exist yet, add it
        from app.core.extensions import db
        from sqlalchemy import text
        try:
            db.session.execute(
                text("ALTER TABLE messages ADD COLUMN is_deleted INTEGER DEFAULT 0"))
            db.session.commit()
        except Exception:
            pass
        message.is_deleted = True

    db.session.commit()

    # Notify WebSocket server about the deletion
    try:
        print(
            f"Need to notify WebSocket server about deletion of message {message_id}")
    except Exception as e:
        print(f"Error notifying WebSocket server: {e}")

    return jsonify({"message": "Message deleted successfully"}), 200
