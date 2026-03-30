from app.core.rate_limiter import check_spam_protection, rate_limit
from app.schemas.message_schema import message_schema, messages_schema
from app.services.message_service import MessageService
from app.services.user_service import UserService
from app.utils.decorators import api_key_required
from flask import Blueprint, jsonify, request

public_messages_bp = Blueprint(
    "public_messages", __name__, url_prefix="/api/public/v1/messages")

@public_messages_bp.route("/", methods=["GET"])
@api_key_required
def get_messages(current_user):
    try:
        page = request.args.get('page', 1, type=int)
        limit = request.args.get('limit', 20, type=int)
        offset = (page - 1) * limit

        thread_with = request.args.get('thread_with')

        messages = MessageService.get_user_messages(
            current_user.id,
            limit=limit,
            offset=offset,
            thread_with=thread_with
        )
        total_count = MessageService.get_user_messages_count(
            current_user.id, thread_with=thread_with)

        return jsonify({
            "messages": messages_schema.dump(messages),
            "pagination": {
                "page": page,
                "limit": limit,
                "total": total_count,
                "pages": (total_count + limit - 1) // limit
            }
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@public_messages_bp.route("/<message_id>", methods=["GET"])
@api_key_required
def get_message(current_user, message_id):
    try:
        message = MessageService.get_message_by_id(message_id)
        if not message:
            return jsonify({"error": "Message not found"}), 404

        if message.sender_id != current_user.id and message.receiver_id != current_user.id:
            return jsonify({"error": "Access denied"}), 403

        return jsonify(message_schema.dump(message)), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@public_messages_bp.route("/", methods=["POST"])
@api_key_required

@rate_limit(limit=50, window=3600, per_user=True)
def send_message(current_user):
    try:
        data = request.get_json() or {}

        recipient_id = data.get('recipient_id')
        content = data.get('content')

        if not recipient_id:
            return jsonify({"error": "Recipient ID is required"}), 400
        if not content:
            return jsonify({"error": "Content is required"}), 400

        is_spam, spam_reason = check_spam_protection(content)
        if is_spam:
            return jsonify({"error": f"Spam detected: {spam_reason}"}), 400

        recipient = UserService.get_user_by_id(recipient_id)
        if not recipient:
            return jsonify({"error": "Recipient not found"}), 404

        if recipient_id == current_user.id:
            return jsonify({"error": "Cannot send message to yourself"}), 400

        message_data = {
            'sender_id': current_user.id,
            'receiver_id': recipient_id,
            'content': content
        }

        if 'media_urls' in data:
            message_data['media_urls'] = data['media_urls']

        message, error = MessageService.send_message(message_data)
        if error:
            return jsonify({"error": error}), 400

        return jsonify(message_schema.dump(message)), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@public_messages_bp.route("/<message_id>", methods=["PUT"])
@api_key_required

@rate_limit(limit=20, window=3600, per_user=True)
def update_message(current_user, message_id):
    try:
        message = MessageService.get_message_by_id(message_id)
        if not message:
            return jsonify({"error": "Message not found"}), 404

        if message.sender_id != current_user.id:
            return jsonify({"error": "Access denied"}), 403

        if message.read_at is not None:
            return jsonify(
                {"error": "Cannot update message that has been read"}), 400

        data = request.get_json() or {}
        update_data = {}

        if 'content' in data:

            is_spam, spam_reason = check_spam_protection(data['content'])
            if is_spam:
                return jsonify({"error": f"Spam detected: {spam_reason}"}), 400
            update_data['content'] = data['content']
        if 'media_urls' in data:
            update_data['media_urls'] = data['media_urls']

        if not update_data:
            return jsonify({"error": "No fields to update"}), 400

        updated_message, error = MessageService.update_message(
            message_id, update_data)
        if error:
            return jsonify({"error": error}), 400

        return jsonify(message_schema.dump(updated_message)), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@public_messages_bp.route("/<message_id>", methods=["DELETE"])
@api_key_required
def delete_message(current_user, message_id):
    try:
        message = MessageService.get_message_by_id(message_id)
        if not message:
            return jsonify({"error": "Message not found"}), 404

        if message.sender_id != current_user.id and message.receiver_id != current_user.id:
            return jsonify({"error": "Access denied"}), 403

        success, error = MessageService.delete_message(message_id)
        if not success:
            return jsonify({"error": error}), 400

        return jsonify({"message": "Message deleted successfully"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@public_messages_bp.route("/read/<message_id>", methods=["POST"])
@api_key_required
def mark_message_as_read(current_user, message_id):
    try:
        message = MessageService.get_message_by_id(message_id)
        if not message:
            return jsonify({"error": "Message not found"}), 404

        if message.receiver_id != current_user.id:
            return jsonify({"error": "Access denied"}), 403

        success, error = MessageService.mark_message_as_read(message_id)
        if not success:
            return jsonify({"error": error}), 400

        return jsonify({"message": "Message marked as read"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@public_messages_bp.route("/unread", methods=["GET"])
@api_key_required
def get_unread_messages(current_user):
    try:
        page = request.args.get('page', 1, type=int)
        limit = request.args.get('limit', 20, type=int)
        offset = (page - 1) * limit

        messages = MessageService.get_unread_messages(
            current_user.id, limit=limit, offset=offset)
        total_count = MessageService.get_unread_messages_count(current_user.id)

        return jsonify({
            "messages": messages_schema.dump(messages),
            "pagination": {
                "page": page,
                "limit": limit,
                "total": total_count,
                "pages": (total_count + limit - 1) // limit
            }
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@public_messages_bp.route("/threads", methods=["GET"])
@api_key_required
def get_message_threads(current_user):
    try:
        page = request.args.get('page', 1, type=int)
        limit = request.args.get('limit', 20, type=int)
        offset = (page - 1) * limit

        threads = MessageService.get_message_threads(
            current_user.id, limit=limit, offset=offset)
        total_count = MessageService.get_message_threads_count(current_user.id)

        return jsonify({
            "threads": threads,
            "pagination": {
                "page": page,
                "limit": limit,
                "total": total_count,
                "pages": (total_count + limit - 1) // limit
            }
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
