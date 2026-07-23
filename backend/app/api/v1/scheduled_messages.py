import uuid
from datetime import datetime

from app.core.extensions import db
from app.models.scheduled_message import ScheduledMessage
from app.utils.decorators import token_required
from flask import Blueprint, jsonify, request

scheduled_bp = Blueprint("scheduled", __name__, url_prefix="/api/v1/scheduled-messages")


@scheduled_bp.route("", methods=["POST"])
@token_required
def create_scheduled(current_user):
    data = request.get_json() or {}
    content = data.get("content", "").strip()
    scheduled_at_str = data.get("scheduled_at")

    if not content or not scheduled_at_str:
        return jsonify({"error": "content and scheduled_at required"}), 400

    try:
        scheduled_at = datetime.fromisoformat(scheduled_at_str.replace("Z", "+00:00")).replace(tzinfo=None)
    except Exception:
        return jsonify({"error": "Invalid scheduled_at format"}), 400

    if scheduled_at <= datetime.utcnow():
        return jsonify({"error": "scheduled_at must be in the future"}), 400

    msg = ScheduledMessage(
        id=uuid.uuid4().hex[:16],
        sender_id=str(current_user.id),
        target_user_id=data.get("target_user_id"),
        channel_id=data.get("channel_id"),
        group_id=data.get("group_id"),
        content=content,
        type=data.get("type", "text"),
        attachments=data.get("attachments"),
        scheduled_at=scheduled_at,
    )
    db.session.add(msg)
    db.session.commit()
    return jsonify(msg.to_dict()), 201


@scheduled_bp.route("", methods=["GET"])
@token_required
def list_scheduled(current_user):
    msgs = (
        ScheduledMessage.query
        .filter_by(sender_id=str(current_user.id), sent_at=None)
        .order_by(ScheduledMessage.scheduled_at.asc())
        .all()
    )
    return jsonify([m.to_dict() for m in msgs])


@scheduled_bp.route("/chat", methods=["POST"])
@token_required
def list_scheduled_for_chat(current_user):
    """Get scheduled messages for a specific chat (to show faded in history)."""
    data = request.get_json() or {}
    target_user_id = data.get("target_user_id")
    channel_id = data.get("channel_id")
    group_id = data.get("group_id")

    query = ScheduledMessage.query.filter_by(sender_id=str(current_user.id), sent_at=None)

    if target_user_id:
        query = query.filter_by(target_user_id=target_user_id)
    elif channel_id:
        query = query.filter_by(channel_id=channel_id)
    elif group_id:
        query = query.filter_by(group_id=group_id)

    msgs = query.order_by(ScheduledMessage.scheduled_at.asc()).all()
    return jsonify([m.to_dict() for m in msgs])


@scheduled_bp.route("/<msg_id>", methods=["DELETE"])
@token_required
def cancel_scheduled(current_user, msg_id):
    msg = ScheduledMessage.query.filter_by(
        id=msg_id, sender_id=str(current_user.id), sent_at=None
    ).first()
    if not msg:
        return jsonify({"error": "Not found"}), 404
    db.session.delete(msg)
    db.session.commit()
    return jsonify({"ok": True})
