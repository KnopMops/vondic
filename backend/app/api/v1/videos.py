import os
from datetime import datetime

from app.core.extensions import db
from app.utils.decorators import token_required
from flask import Blueprint, jsonify, request
from sqlalchemy import text

videos_bp = Blueprint("videos", __name__, url_prefix="/api/v1/videos")


def _get_ip() -> str:
    ip = request.headers.get("X-Forwarded-For") or request.remote_addr or ""
    # X-Forwarded-For may contain list, take first
    if isinstance(ip, str) and "," in ip:
        ip = ip.split(",", 1)[0].strip()
    return ip


@videos_bp.route("/", methods=["GET"])
def list_videos():
    sort = (request.args.get("sort") or "created_at").lower()
    order = (request.args.get("order") or "desc").lower()
    limit = int(request.args.get("limit") or 24)
    offset = int(request.args.get("offset") or 0)
    user_id = request.args.get("user_id")

    if sort not in ("likes", "views", "created_at"):
        sort = "created_at"
    if order not in ("asc", "desc"):
        order = "desc"

    where = "is_deleted = 0"
    params = {"limit": limit, "offset": offset}
    if user_id:
        where += " AND author_id = :author_id"
        params["author_id"] = user_id
    sql = f"""
        SELECT v.*, u.username AS author_name, u.avatar_url AS author_avatar, u.premium AS author_premium
        FROM videos v
        LEFT JOIN users u ON u.id = v.author_id
        WHERE {where}
        ORDER BY {sort} {order.upper()}
        LIMIT :limit OFFSET :offset
    """
    rows = db.session.execute(text(sql), params).fetchall()
    items = []
    for r in rows:
        d = dict(r._mapping)
        items.append(d)
    return jsonify(items), 200


@videos_bp.route("/", methods=["POST"])
@token_required
def create_video(current_user):
    data = request.get_json() or {}
    title = data.get("title")
    url = data.get("url")
    description = data.get("description")
    poster = data.get("poster")
    duration = data.get("duration")
    tags = data.get("tags")
    if not title or not url:
        return jsonify({"error": "title and url are required"}), 400
    v_id = data.get("id") or os.popen(
        "powershell -NoProfile -Command \"[guid]::NewGuid().ToString()\"").read().strip() or None
    if not v_id:
        v_id = os.urandom(16).hex()
    try:
        db.session.execute(text("""
            INSERT INTO videos (id, author_id, title, description, url, poster, duration, created_at, updated_at, views, likes, is_deleted, tags)
            VALUES (:id, :author_id, :title, :description, :url, :poster, :duration, :created_at, :updated_at, 0, 0, 0, :tags)
        """), {
            "id": v_id,
            "author_id": current_user.id,
            "title": title,
            "description": description,
            "url": url,
            "poster": poster,
            "duration": duration,
            "created_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat(),
            "tags": None if tags is None else (tags if isinstance(tags, str) else str(tags)),
        })
        db.session.commit()
        return jsonify({
            "id": v_id,
            "author_id": current_user.id,
            "title": title,
            "description": description,
            "url": url,
            "poster": poster,
            "duration": duration,
            "created_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat(),
            "views": 0,
            "likes": 0,
            "is_deleted": 0,
            "tags": tags,
            "author_name": getattr(current_user, "username", None),
            "author_avatar": getattr(current_user, "avatar_url", None),
            "author_premium": getattr(current_user, "premium", 0),
        }), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 400


@videos_bp.route("/view", methods=["POST"])
@token_required
def register_view(current_user):
    data = request.get_json() or {}
    video_id = data.get("video_id")
    if not video_id:
        return jsonify({"error": "video_id is required"}), 400

    ip = _get_ip()

    # 1. Per-account: count only once
    existing_user_row = db.session.execute(
        text("SELECT id FROM video_views WHERE video_id = :vid AND user_id = :uid"),
        {"vid": video_id, "uid": current_user.id},
    ).fetchone()
    if existing_user_row:
        return jsonify({"ok": True, "counted": False, "reason": "already_counted_for_user"}), 200

    # 2. IP cap: do not count more than 3 per IP per video
    ip_total_row = db.session.execute(
        text("SELECT SUM(count) as total FROM video_views WHERE video_id = :vid AND ip = :ip"),
        {"vid": video_id, "ip": ip},
    ).fetchone()
    ip_total = int((ip_total_row[0] or 0)) if ip_total_row else 0
    if ip_total >= 3:
        return jsonify({"ok": True, "counted": False, "reason": "ip_cap_reached"}), 200

    try:
        # Insert per-user view row
        db.session.execute(text("""
            INSERT INTO video_views (video_id, user_id, ip, count, last_viewed_at)
            VALUES (:vid, :uid, :ip, 1, :ts)
        """), {"vid": video_id, "uid": current_user.id, "ip": ip, "ts": datetime.utcnow().isoformat()})

        # Increment video.views
        db.session.execute(text("""
            UPDATE videos SET views = COALESCE(views, 0) + 1, updated_at = :ts WHERE id = :vid
        """), {"ts": datetime.utcnow().isoformat(), "vid": video_id})

        db.session.commit()
        return jsonify({"ok": True, "counted": True}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 400
