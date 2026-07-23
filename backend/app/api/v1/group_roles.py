import uuid
from app.core.extensions import db
from app.models.group_role import GroupRole
from app.utils.decorators import token_required
from flask import Blueprint, jsonify, request

group_roles_bp = Blueprint("group_roles", __name__, url_prefix="/api/v1/group-roles")


@group_roles_bp.route("", methods=["GET"])
@token_required
def list_roles(current_user):
    group_id = request.args.get("group_id")
    if not group_id:
        return jsonify({"error": "group_id required"}), 400
    roles = GroupRole.query.filter_by(group_id=group_id).all()
    return jsonify([{
        "id": r.id, "user_id": r.user_id, "role": r.role
    } for r in roles])


@group_roles_bp.route("", methods=["POST"])
@token_required
def set_role(current_user):
    data = request.get_json() or {}
    group_id = data.get("group_id")
    user_id = data.get("user_id")
    role = data.get("role", "member")
    if not group_id or not user_id:
        return jsonify({"error": "group_id and user_id required"}), 400
    if role not in ("admin", "moderator", "member"):
        return jsonify({"error": "role must be admin/moderator/member"}), 400

    existing = GroupRole.query.filter_by(group_id=group_id, user_id=user_id).first()
    if existing:
        existing.role = role
    else:
        db.session.add(GroupRole(group_id=group_id, user_id=user_id, role=role))
    db.session.commit()
    return jsonify({"ok": True, "role": role})


@group_roles_bp.route("", methods=["DELETE"])
@token_required
def remove_role(current_user):
    data = request.get_json() or {}
    group_id = data.get("group_id")
    user_id = data.get("user_id")
    if not group_id or not user_id:
        return jsonify({"error": "group_id and user_id required"}), 400
    role = GroupRole.query.filter_by(group_id=group_id, user_id=user_id).first()
    if role:
        db.session.delete(role)
        db.session.commit()
    return jsonify({"ok": True})


@group_roles_bp.route("/check", methods=["GET"])
@token_required
def check_role(current_user):
    group_id = request.args.get("group_id")
    user_id = request.args.get("user_id", str(current_user.id))
    if not group_id:
        return jsonify({"error": "group_id required"}), 400
    role = GroupRole.query.filter_by(group_id=group_id, user_id=user_id).first()
    return jsonify({"role": role.role if role else "member"})
