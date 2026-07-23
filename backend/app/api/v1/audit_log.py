from datetime import datetime
from app.core.extensions import db
from app.models.audit_log import AuditLog
from app.utils.decorators import token_required
from flask import Blueprint, jsonify, request

audit_log_bp = Blueprint("audit_log", __name__, url_prefix="/api/v1/audit-log")


def log_audit(user_id: str, action: str, group_id: str = None, channel_id: str = None,
              target_user_id: str = None, details: dict = None):
    """Helper to write audit entries from other modules."""
    try:
        entry = AuditLog(
            user_id=user_id, action=action, group_id=group_id,
            channel_id=channel_id, target_user_id=target_user_id, details=details,
        )
        db.session.add(entry)
        db.session.commit()
    except Exception:
        db.session.rollback()


@audit_log_bp.route("", methods=["GET"])
@token_required
def list_audit(current_user):
    group_id = request.args.get("group_id")
    channel_id = request.args.get("channel_id")
    limit = min(int(request.args.get("limit", 50)), 200)

    query = AuditLog.query
    if group_id:
        query = query.filter_by(group_id=group_id)
    elif channel_id:
        query = query.filter_by(channel_id=channel_id)
    else:
        return jsonify({"error": "group_id or channel_id required"}), 400

    logs = query.order_by(AuditLog.created_at.desc()).limit(limit).all()
    return jsonify([l.to_dict() for l in logs])
