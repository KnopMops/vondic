"""
Message reactions, editing, and read receipts API
"""
from datetime import datetime

from app.core.extensions import db
from app.models.message import Message
from app.utils.decorators import token_required
from flask import Blueprint, jsonify, request

messages_bp = Blueprint("messages", __name__, url_prefix="/api/v1/messages")


@messages_bp.route("/<message_id>/reaction", methods=["POST"])
@token_required
def add_reaction(current_user, message_id):
    """Add or remove reaction to a message (Telegram-style)"""
    data = request.get_json() or {}
    emoji = data.get("emoji")
    
    if not emoji:
        return jsonify({"error": "emoji is required"}), 400
    
    message = Message.query.get(message_id)
    if not message:
        return jsonify({"error": "Message not found"}), 404
    
    reactions = message.reactions or []
    
    # Find if user already reacted with this emoji
    user_reaction = next((r for r in reactions if r.get("user_id") == current_user.id and r.get("emoji") == emoji), None)
    
    if user_reaction:
        # Remove reaction (toggle off)
        reactions = [r for r in reactions if r.get("user_id") != current_user.id or r.get("emoji") != emoji]
    else:
        # Add new reaction
        reactions.append({
            "user_id": current_user.id,
            "username": current_user.username,
            "emoji": emoji,
            "created_at": datetime.utcnow().isoformat()
        })
    
    try:
        message.reactions = reactions
        db.session.commit()
        return jsonify({
            "success": True,
            "reactions": reactions,
            "action": "removed" if user_reaction else "added"
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


@messages_bp.route("/<message_id>/edit", methods=["PUT"])
@token_required
def edit_message(current_user, message_id):
    """Edit own message (Telegram-style)"""
    data = request.get_json() or {}
    new_content = data.get("content")
    
    if not new_content:
        return jsonify({"error": "content is required"}), 400
    
    message = Message.query.get(message_id)
    if not message:
        return jsonify({"error": "Message not found"}), 404
    
    # Only sender can edit
    if message.sender_id != current_user.id:
        return jsonify({"error": "You can only edit your own messages"}), 403
    
    # Can edit within 48 hours
    if (datetime.utcnow() - message.created_at).total_seconds() > 172800:  # 48 hours
        return jsonify({"error": "Message can only be edited within 48 hours"}), 400
    
    try:
        # Save edit history
        edit_history = message.edit_history or []
        edit_history.append({
            "content": message.content,
            "edited_at": datetime.utcnow().isoformat()
        })
        
        message.content = new_content
        message.is_edited = True
        message.edit_history = edit_history
        message.updated_at = datetime.utcnow()
        
        db.session.commit()
        return jsonify({
            "success": True,
            "message": message.to_dict()
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


@messages_bp.route("/<message_id>/read", methods=["POST"])
@token_required
def mark_message_read(current_user, message_id):
    """Mark message as read (add to read_by list)"""
    message = Message.query.get(message_id)
    if not message:
        return jsonify({"error": "Message not found"}), 404
    
    read_by = message.read_by or []
    
    # Check if already read by this user
    if not any(r.get("user_id") == current_user.id for r in read_by):
        read_by.append({
            "user_id": current_user.id,
            "username": current_user.username,
            "read_at": datetime.utcnow().isoformat()
        })
    
    try:
        message.read_by = read_by
        db.session.commit()
        return jsonify({
            "success": True,
            "read_by": read_by
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


@messages_bp.route("/<message_id>/reply", methods=["POST"])
@token_required
def reply_to_message(current_user, message_id):
    """Reply to a message (creates threaded conversation)"""
    data = request.get_json() or {}
    content = data.get("content")
    
    if not content:
        return jsonify({"error": "content is required"}), 400
    
    parent_message = Message.query.get(message_id)
    if not parent_message:
        return jsonify({"error": "Message not found"}), 404
    
    # Create reply message
    reply_message = Message(
        content=content,
        sender_id=current_user.id,
        target_id=parent_message.target_id,
        group_id=parent_message.group_id,
        channel_id=parent_message.channel_id,
        reply_to_id=message_id
    )
    
    try:
        db.session.add(reply_message)
        db.session.commit()
        return jsonify({
            "success": True,
            "message": reply_message.to_dict()
        }), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


@messages_bp.route("/<message_id>/forward", methods=["POST"])
@token_required
def forward_message(current_user, message_id):
    """Forward a message to another chat"""
    data = request.get_json() or {}
    target_id = data.get("target_id")  # User ID to forward to
    group_id = data.get("group_id")    # Or group ID
    
    if not target_id and not group_id:
        return jsonify({"error": "target_id or group_id is required"}), 400
    
    original_message = Message.query.get(message_id)
    if not original_message:
        return jsonify({"error": "Message not found"}), 404
    
    # Create forwarded message
    forwarded_message = Message(
        content=original_message.content,
        attachments=original_message.attachments,
        sender_id=current_user.id,
        target_id=target_id,
        group_id=group_id,
        forwarded_from_id=message_id,
        type=original_message.type
    )
    
    try:
        db.session.add(forwarded_message)
        db.session.commit()
        return jsonify({
            "success": True,
            "message": forwarded_message.to_dict()
        }), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


@messages_bp.route("/<message_id>/delete-for-everyone", methods=["POST"])
@token_required
def delete_message_for_everyone(current_user, message_id):
    """Delete message for all participants (Telegram-style)"""
    message = Message.query.get(message_id)
    if not message:
        return jsonify({"error": "Message not found"}), 404
    
    # Only sender or admin can delete for everyone
    if message.sender_id != current_user.id and current_user.role != "Admin":
        return jsonify({"error": "You can only delete your own messages"}), 403
    
    # Can delete within 7 days
    if (datetime.utcnow() - message.created_at).total_seconds() > 604800:  # 7 days
        return jsonify({"error": "Message can only be deleted within 7 days"}), 400
    
    try:
        message.is_deleted = True
        message.content = "Сообщение удалено"
        message.attachments = []
        message.updated_at = datetime.utcnow()
        
        db.session.commit()
        return jsonify({
            "success": True,
            "message": "Message deleted for everyone"
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500
