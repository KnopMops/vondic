import uuid

from app.core.extensions import db
from app.models.chat_folder import ChatFolder, ChatFolderItem
from app.utils.decorators import token_required
from flask import Blueprint, jsonify, request

chat_folders_bp = Blueprint("chat_folders", __name__, url_prefix="/api/v1/chat-folders")


@chat_folders_bp.route("", methods=["GET"])
@token_required
def list_folders(current_user):
    folders = (
        ChatFolder.query
        .filter_by(user_id=str(current_user.id))
        .order_by(ChatFolder.position.asc())
        .all()
    )
    return jsonify([f.to_dict() for f in folders])


@chat_folders_bp.route("", methods=["POST"])
@token_required
def create_folder(current_user):
    data = request.get_json() or {}
    name = (data.get("name") or "").strip()
    if not name:
        return jsonify({"error": "name required"}), 400
    icon = data.get("icon", "📁")

    max_pos = db.session.query(db.func.max(ChatFolder.position)).filter_by(
        user_id=str(current_user.id)).scalar() or 0

    folder = ChatFolder(
        id=uuid.uuid4().hex[:12],
        user_id=str(current_user.id),
        name=name,
        icon=icon,
        position=max_pos + 1,
    )
    db.session.add(folder)
    db.session.commit()
    return jsonify(folder.to_dict()), 201


@chat_folders_bp.route("/<folder_id>", methods=["PUT"])
@token_required
def update_folder(current_user, folder_id):
    folder = ChatFolder.query.filter_by(
        id=folder_id, user_id=str(current_user.id)).first()
    if not folder:
        return jsonify({"error": "Not found"}), 404
    data = request.get_json() or {}
    if "name" in data:
        folder.name = data["name"]
    if "icon" in data:
        folder.icon = data["icon"]
    if "position" in data:
        folder.position = int(data["position"])
    db.session.commit()
    return jsonify(folder.to_dict())


@chat_folders_bp.route("/<folder_id>", methods=["DELETE"])
@token_required
def delete_folder(current_user, folder_id):
    folder = ChatFolder.query.filter_by(
        id=folder_id, user_id=str(current_user.id)).first()
    if not folder:
        return jsonify({"error": "Not found"}), 404
    db.session.delete(folder)
    db.session.commit()
    return jsonify({"ok": True})


@chat_folders_bp.route("/<folder_id>/items", methods=["POST"])
@token_required
def add_item(current_user, folder_id):
    folder = ChatFolder.query.filter_by(
        id=folder_id, user_id=str(current_user.id)).first()
    if not folder:
        return jsonify({"error": "Not found"}), 404
    data = request.get_json() or {}
    chat_type = data.get("type")
    chat_id = data.get("chat_id")
    if not chat_type or not chat_id:
        return jsonify({"error": "type and chat_id required"}), 400
    if chat_type not in ("dm", "group", "channel"):
        return jsonify({"error": "type must be dm/group/channel"}), 400

    existing = ChatFolderItem.query.filter_by(
        folder_id=folder_id, chat_type=chat_type, chat_id=str(chat_id)).first()
    if existing:
        return jsonify({"ok": True})

    item = ChatFolderItem(folder_id=folder_id, chat_type=chat_type, chat_id=str(chat_id))
    db.session.add(item)
    db.session.commit()
    return jsonify({"ok": True}), 201


@chat_folders_bp.route("/<folder_id>/items", methods=["DELETE"])
@token_required
def remove_item(current_user, folder_id):
    folder = ChatFolder.query.filter_by(
        id=folder_id, user_id=str(current_user.id)).first()
    if not folder:
        return jsonify({"error": "Not found"}), 404
    data = request.get_json() or {}
    chat_type = data.get("type")
    chat_id = data.get("chat_id")
    if not chat_type or not chat_id:
        return jsonify({"error": "type and chat_id required"}), 400

    item = ChatFolderItem.query.filter_by(
        folder_id=folder_id, chat_type=chat_type, chat_id=str(chat_id)).first()
    if item:
        db.session.delete(item)
        db.session.commit()
    return jsonify({"ok": True})
