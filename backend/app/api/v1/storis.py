import uuid
from datetime import datetime, timedelta, timezone

from app.core.extensions import db
from app.models.user import User
from app.services.friendship_service import FriendshipService
from app.utils.decorators import token_required
from flask import Blueprint, jsonify, request
from sqlalchemy.orm.attributes import flag_modified

storis_bp = Blueprint("storis", __name__, url_prefix="/api/v1/storis")


def parse_created_at(value):
    if not value:
        return None
    try:
        s = str(value)
        if s.endswith("Z"):
            s = s[:-1] + "+00:00"
        dt = datetime.fromisoformat(s)
        if dt.tzinfo:
            return dt.astimezone(timezone.utc)
        return dt.replace(tzinfo=timezone.utc)
    except Exception:
        return None


def normalize_storis(items):
    now = datetime.now(timezone.utc)
    changed = False
    normalized = []
    if not isinstance(items, list):
        return [], True
    for it in items:
        if not isinstance(it, dict):
            changed = True
            continue
        item = dict(it)
        if not item.get("id"):
            item["id"] = str(uuid.uuid4())
            changed = True
        created_raw = item.get("created_at")
        dt = parse_created_at(created_raw)
        if not dt:
            item["created_at"] = now.isoformat()
            dt = now
            changed = True
        if now - dt > timedelta(days=1):
            changed = True
            continue
        reactions = item.get("reactions")
        if not isinstance(reactions, list):
            item["reactions"] = []
            changed = True
        normalized.append(item)
    return normalized, changed


@storis_bp.route("/friends", methods=["POST"])
@token_required
def friends_with_storis(current_user):
    data = request.get_json() or {}
    target_user_id = data.get("user_id") or current_user.id
    friends = FriendshipService.get_friends(target_user_id)
    result = []
    changed_any = False
    for f in friends:
        uid = f.get("id") or f.get("user_id") or f.get("friend_id")
        if not uid:
            continue
        u = User.query.get(uid)
        if not u:
            continue
        items, changed = normalize_storis(u.storis)
        if changed:
            u.storis = items
            changed_any = True
        if isinstance(items, list) and len(items) > 0:
            d = u.to_dict()
            result.append(d)
    if changed_any:
        db.session.commit()
    return jsonify(result), 200


@storis_bp.route("/create", methods=["POST"])
@token_required
def create_storis(current_user):
    data = request.get_json() or {}
    media_url = data.get("url")
    media_type = data.get("type") or "image"
    text = (data.get("text") or "").strip()
    if not media_url:
        return jsonify({"error": "url is required"}), 400
    try:
        user = User.query.get(current_user.id)
        items = user.storis or []
        item = {
            "id": str(uuid.uuid4()),
            "url": media_url,
            "type": media_type,
            "created_at": request.headers.get("X-Client-Time")
            or datetime.now(timezone.utc).isoformat(),
            "reactions": [],
        }
        if text:
            item["text"] = text
        items.append(item)
        user.storis = items
        flag_modified(user, "storis")
        db.session.commit()
        return jsonify({"success": True, "storis": user.storis}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


@storis_bp.route("/delete", methods=["POST"])
@token_required
def delete_storis(current_user):
    data = request.get_json() or {}
    story_id = data.get("story_id")
    if not story_id:
        return jsonify({"error": "story_id is required"}), 400
    try:
        user = User.query.get(current_user.id)
        if not user:
            return jsonify({"error": "User not found"}), 404
        items, _ = normalize_storis(user.storis)
        new_items = [it for it in items if str(it.get("id")) != str(story_id)]
        if len(new_items) == len(items):
            return jsonify({"error": "Story not found"}), 404
        user.storis = new_items
        flag_modified(user, "storis")
        db.session.commit()
        return jsonify({"success": True, "storis": user.storis}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


@storis_bp.route("/user", methods=["POST"])
@token_required
def user_storis(current_user):
    data = request.get_json() or {}
    user_id = data.get("user_id") or current_user.id
    user = User.query.get(user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404
    items, changed = normalize_storis(user.storis)
    if changed:
        user.storis = items
        db.session.commit()
    return jsonify(items), 200


@storis_bp.route("/react", methods=["POST"])
@token_required
def react_storis(current_user):
    data = request.get_json() or {}
    owner_id = data.get("owner_id")
    story_id = data.get("story_id")
    emoji = data.get("emoji")
    if not owner_id or not story_id or not emoji:
        return jsonify(
            {"error": "owner_id, story_id and emoji are required"}), 400
    user = User.query.get(owner_id)
    if not user:
        return jsonify({"error": "User not found"}), 404
    items, _ = normalize_storis(user.storis)
    target = None
    for item in items:
        if str(item.get("id")) == str(story_id):
            target = item
            break
    if not target:
        return jsonify({"error": "Story not found"}), 404
    reactions = [r for r in (target.get("reactions")
                             or []) if isinstance(r, dict)]
    idx = next(
        (
            i
            for i, r in enumerate(reactions)
            if str(r.get("user_id")) == str(current_user.id)
        ),
        None,
    )
    now = datetime.now(timezone.utc).isoformat()
    if idx is not None:
        if reactions[idx].get("emoji") == emoji:
            reactions.pop(idx)
        else:
            reactions[idx] = {
                "user_id": str(current_user.id),
                "emoji": emoji,
                "created_at": now,
            }
    else:
        reactions.append(
            {"user_id": str(current_user.id), "emoji": emoji,
             "created_at": now}
        )
    target["reactions"] = reactions
    user.storis = items
    flag_modified(user, "storis")
    db.session.commit()
    return jsonify({"story": target}), 200
