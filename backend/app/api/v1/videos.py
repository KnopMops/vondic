import json
import os
import uuid
from datetime import datetime
from urllib.parse import urlparse

from app.core.extensions import db
from app.utils.decorators import token_required
from flask import Blueprint, current_app, jsonify, request
from sqlalchemy import text

videos_bp = Blueprint("videos", __name__, url_prefix="/api/v1/videos")


def _get_ip() -> str:
    ip = request.headers.get("X-Forwarded-For") or request.remote_addr or ""
    # X-Forwarded-For may contain list, take first
    if isinstance(ip, str) and "," in ip:
        ip = ip.split(",", 1)[0].strip()
    return ip


def _ensure_video_likes_table():
    try:
        if db.engine.dialect.name == "sqlite":
            cols = db.session.execute(
                text("PRAGMA table_info(video_likes)")).fetchall()
            if not cols:
                db.session.execute(
                    text("""
                    CREATE TABLE video_likes (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        video_id TEXT NOT NULL,
                        user_id TEXT NOT NULL,
                        created_at TEXT
                    )
                """)
                )
                db.session.execute(
                    text(
                        "CREATE UNIQUE INDEX IF NOT EXISTS uq_video_likes_vid_uid ON video_likes(video_id, user_id)"
                    )
                )
                db.session.execute(
                    text(
                        "CREATE INDEX IF NOT EXISTS idx_video_likes_vid ON video_likes(video_id)"
                    )
                )
                db.session.commit()
        else:
            db.session.execute(
                text("""
                CREATE TABLE IF NOT EXISTS video_likes (
                    id BIGSERIAL PRIMARY KEY,
                    video_id TEXT NOT NULL,
                    user_id TEXT NOT NULL,
                    created_at TEXT
                )
            """)
            )
            db.session.execute(
                text(
                    "CREATE UNIQUE INDEX IF NOT EXISTS uq_video_likes_vid_uid ON video_likes(video_id, user_id)"
                )
            )
            db.session.execute(
                text(
                    "CREATE INDEX IF NOT EXISTS idx_video_likes_vid ON video_likes(video_id)"
                )
            )
            db.session.commit()
    except Exception:
        pass


def _ensure_video_views_table():
    try:
        if db.engine.dialect.name == "sqlite":
            cols = db.session.execute(
                text("PRAGMA table_info(video_views)")).fetchall()
            if not cols:
                db.session.execute(
                    text("""
                    CREATE TABLE video_views (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        video_id TEXT NOT NULL,
                        user_id TEXT,
                        ip TEXT,
                        count INTEGER DEFAULT 0,
                        last_viewed_at TEXT
                    )
                """)
                )
                db.session.execute(
                    text(
                        "CREATE INDEX IF NOT EXISTS idx_video_views_vid ON video_views(video_id)"
                    )
                )
                db.session.execute(
                    text(
                        "CREATE INDEX IF NOT EXISTS idx_video_views_vid_ip ON video_views(video_id, ip)"
                    )
                )
                db.session.commit()
        else:
            db.session.execute(
                text("""
                CREATE TABLE IF NOT EXISTS video_views (
                    id BIGSERIAL PRIMARY KEY,
                    video_id TEXT NOT NULL,
                    user_id TEXT,
                    ip TEXT,
                    count INTEGER DEFAULT 0,
                    last_viewed_at TEXT
                )
            """)
            )
            db.session.execute(
                text(
                    "CREATE INDEX IF NOT EXISTS idx_video_views_vid ON video_views(video_id)"
                )
            )
            db.session.execute(
                text(
                    "CREATE INDEX IF NOT EXISTS idx_video_views_vid_ip ON video_views(video_id, ip)"
                )
            )
            db.session.commit()
    except Exception:
        pass


def _ensure_video_columns():
    try:
        if db.engine.dialect.name == "sqlite":
            cols = db.session.execute(
                text("PRAGMA table_info(videos)")).fetchall()
            col_names = [c[1] for c in cols] if cols else []
            if "allow_comments" not in col_names:
                db.session.execute(
                    text("ALTER TABLE videos ADD COLUMN allow_comments INTEGER DEFAULT 1"))
            if "is_nsfw" not in col_names:
                db.session.execute(
                    text("ALTER TABLE videos ADD COLUMN is_nsfw INTEGER DEFAULT 0"))
            if "has_profanity" not in col_names:
                db.session.execute(
                    text("ALTER TABLE videos ADD COLUMN has_profanity INTEGER DEFAULT 0"))
            if "is_published" not in col_names:
                db.session.execute(
                    text("ALTER TABLE videos ADD COLUMN is_published INTEGER DEFAULT 1"))
        else:
            db.session.execute(
                text(
                    "ALTER TABLE videos ADD COLUMN IF NOT EXISTS allow_comments BOOLEAN DEFAULT TRUE"
                )
            )
            db.session.execute(
                text(
                    "ALTER TABLE videos ADD COLUMN IF NOT EXISTS is_nsfw BOOLEAN DEFAULT FALSE"
                )
            )
            db.session.execute(
                text(
                    "ALTER TABLE videos ADD COLUMN IF NOT EXISTS has_profanity BOOLEAN DEFAULT FALSE"
                )
            )
            db.session.execute(
                text(
                    "ALTER TABLE videos ADD COLUMN IF NOT EXISTS is_published BOOLEAN DEFAULT TRUE"
                )
            )
        db.session.commit()
    except Exception:
        pass


def _ensure_video_checks_table():
    try:
        if db.engine.dialect.name == "sqlite":
            db.session.execute(
                text("""
                CREATE TABLE IF NOT EXISTS video_checks (
                    id TEXT PRIMARY KEY,
                    video_url TEXT,
                    file_path TEXT,
                    status TEXT,
                    result_json TEXT,
                    error TEXT,
                    created_at TEXT,
                    updated_at TEXT
                )
            """)
            )
            db.session.execute(
                text(
                    "CREATE INDEX IF NOT EXISTS idx_video_checks_status ON video_checks(status)"
                )
            )
            db.session.commit()
        else:
            db.session.execute(
                text("""
                CREATE TABLE IF NOT EXISTS video_checks (
                    id TEXT PRIMARY KEY,
                    video_url TEXT,
                    file_path TEXT,
                    status TEXT,
                    result_json TEXT,
                    error TEXT,
                    created_at TEXT,
                    updated_at TEXT
                )
            """)
            )
            db.session.execute(
                text(
                    "CREATE INDEX IF NOT EXISTS idx_video_checks_status ON video_checks(status)"
                )
            )
            db.session.commit()
    except Exception:
        pass


def _cond_is_deleted(prefix: str = "") -> str:
    col = f"{prefix}is_deleted" if prefix else "is_deleted"
    if db.engine.dialect.name == "sqlite":
        return f"{col} = 0"
    return f"COALESCE(CAST({col} AS INT), 0) = 0"


def _cond_is_published(prefix: str = "") -> str:
    col = f"{prefix}is_published" if prefix else "is_published"
    if db.engine.dialect.name == "sqlite":
        return f"{col} = 1"
    return f"COALESCE(CAST({col} AS INT), 1) = 1"


def _publish_video_check(job_id: str, file_path: str, video_url: str):
    import pika

    rabbit_url = os.environ.get(
        "RABBITMQ_URL", "amqp://guest:guest@localhost:5672/%2F")
    params = pika.URLParameters(rabbit_url)
    connection = pika.BlockingConnection(params)
    channel = connection.channel()
    channel.queue_declare(queue="video_checks", durable=True)
    payload = json.dumps(
        {
            "job_id": job_id,
            "file_path": file_path,
            "video_url": video_url,
        },
        ensure_ascii=False,
    )
    channel.basic_publish(
        exchange="",
        routing_key="video_checks",
        body=payload,
        properties=pika.BasicProperties(delivery_mode=2),
    )
    connection.close()


def _sync_video_views(video_id: str):
    _ensure_video_views_table()
    row = db.session.execute(
        text("""
        SELECT COALESCE(SUM(count), 0) FROM video_views WHERE video_id = :vid
    """),
        {"vid": video_id},
    ).fetchone()
    views = int(row[0] or 0) if row else 0
    db.session.execute(
        text("""
        UPDATE videos SET views = :views, updated_at = :ts WHERE id = :vid
    """),
        {"views": views, "ts": datetime.utcnow().isoformat(), "vid": video_id},
    )
    return views


def _sync_video_likes(video_id: str):
    _ensure_video_likes_table()
    row = db.session.execute(
        text("""
        SELECT COUNT(1) FROM video_likes WHERE video_id = :vid
    """),
        {"vid": video_id},
    ).fetchone()
    likes = int(row[0] or 0) if row else 0
    db.session.execute(
        text("""
        UPDATE videos SET likes = :likes, updated_at = :ts WHERE id = :vid
    """),
        {"likes": likes, "ts": datetime.utcnow().isoformat(), "vid": video_id},
    )
    return likes


@videos_bp.route("/", methods=["GET"])
def list_videos():
    _ensure_video_views_table()
    _ensure_video_likes_table()
    _ensure_video_columns()
    sort = (request.args.get("sort") or "created_at").lower()
    order = (request.args.get("order") or "desc").lower()
    limit = int(request.args.get("limit") or 24)
    offset = int(request.args.get("offset") or 0)
    user_id = request.args.get("user_id")
    shorts = request.args.get("shorts")

    if sort not in ("likes", "views", "created_at"):
        sort = "created_at"
    if order not in ("asc", "desc"):
        order = "desc"

    where = f"{_cond_is_deleted()} AND {_cond_is_published()}"
    params = {"limit": limit, "offset": offset}
    if user_id:
        where += " AND author_id = :author_id"
        params["author_id"] = user_id
    if shorts in ("1", "true", "yes"):
        where += " AND COALESCE(duration, 0) <= 60"
    if sort == "views":
        where += " AND (SELECT COALESCE(SUM(count), 0) FROM video_views vv WHERE vv.video_id = v.id) > 0"
    if sort == "likes":
        _ensure_video_likes_table()
        where += (
            " AND (SELECT COUNT(1) FROM video_likes vl WHERE vl.video_id = v.id) > 0"
        )
    order_field = "v.created_at"
    if sort == "views":
        order_field = "views_calc"
    elif sort == "likes":
        order_field = "likes_calc"
    sql = f"""
        SELECT v.*,
               u.username AS author_name,
               u.avatar_url AS author_avatar,
               u.premium AS author_premium,
               (SELECT COALESCE(SUM(count), 0) FROM video_views vv WHERE vv.video_id = v.id) AS views_calc,
               (SELECT COUNT(1) FROM video_likes vl WHERE vl.video_id = v.id) AS likes_calc
        FROM videos v
        LEFT JOIN users u ON u.id = v.author_id
        WHERE {where}
        ORDER BY {order_field} {order.upper()}
        LIMIT :limit OFFSET :offset
    """
    rows = db.session.execute(text(sql), params).fetchall()
    items = []
    for r in rows:
        d = dict(r._mapping)
        d["views"] = int(d.get("views_calc") or 0)
        d["likes"] = int(d.get("likes_calc") or 0)
        items.append(d)
    return jsonify(items), 200


@videos_bp.route("/<video_id>", methods=["GET"])
def get_video(video_id):
    _ensure_video_views_table()
    _ensure_video_likes_table()
    _ensure_video_columns()
    row = db.session.execute(
        text(f"""
        SELECT v.*,
               u.username AS author_name,
               u.avatar_url AS author_avatar,
               u.premium AS author_premium,
               (SELECT COALESCE(SUM(count), 0) FROM video_views vv WHERE vv.video_id = v.id) AS views_calc,
               (SELECT COUNT(1) FROM video_likes vl WHERE vl.video_id = v.id) AS likes_calc
        FROM videos v
        LEFT JOIN users u ON u.id = v.author_id
        WHERE v.id = :id AND {_cond_is_deleted("v.")} AND {_cond_is_published("v.")}
    """),
        {"id": video_id},
    ).fetchone()
    if not row:
        return jsonify({"error": "Video not found"}), 404
    data = dict(row._mapping)
    data["views"] = int(data.get("views_calc") or 0)
    data["likes"] = int(data.get("likes_calc") or 0)
    return jsonify(data), 200


@videos_bp.route("/my", methods=["GET"])
@token_required
def list_my_videos(current_user):
    _ensure_video_views_table()
    _ensure_video_likes_table()
    _ensure_video_columns()
    sort = (request.args.get("sort") or "created_at").lower()
    order = (request.args.get("order") or "desc").lower()
    limit = int(request.args.get("limit") or 100)
    offset = int(request.args.get("offset") or 0)
    if sort not in ("likes", "views", "created_at"):
        sort = "created_at"
    if order not in ("asc", "desc"):
        order = "desc"
    order_field = "v.created_at"
    if sort == "views":
        order_field = "views_calc"
    elif sort == "likes":
        order_field = "likes_calc"
    sql = f"""
        SELECT v.*,
               u.username AS author_name,
               u.avatar_url AS author_avatar,
               u.premium AS author_premium,
               (SELECT COALESCE(SUM(count), 0) FROM video_views vv WHERE vv.video_id = v.id) AS views_calc,
               (SELECT COUNT(1) FROM video_likes vl WHERE vl.video_id = v.id) AS likes_calc
        FROM videos v
        LEFT JOIN users u ON u.id = v.author_id
        WHERE {_cond_is_deleted("v.")} AND v.author_id = :author_id
        ORDER BY {order_field} {order.upper()}
        LIMIT :limit OFFSET :offset
    """
    rows = db.session.execute(
        text(sql),
        {
            "author_id": current_user.id,
            "limit": limit,
            "offset": offset,
        },
    ).fetchall()
    items = []
    for r in rows:
        d = dict(r._mapping)
        d["views"] = int(d.get("views_calc") or 0)
        d["likes"] = int(d.get("likes_calc") or 0)
        items.append(d)
    return jsonify(items), 200


@videos_bp.route("/<video_id>", methods=["PATCH"])
@token_required
def update_video(current_user, video_id):
    data = request.get_json() or {}
    title = data.get("title")
    description = data.get("description")
    is_published = data.get("is_published")
    if title is not None and not str(title).strip():
        return jsonify({"error": "title cannot be empty"}), 400
    row = db.session.execute(
        text(f"""
        SELECT id FROM videos WHERE id = :id AND author_id = :author_id AND {_cond_is_deleted()}
    """),
        {"id": video_id, "author_id": current_user.id},
    ).fetchone()
    if not row:
        return jsonify({"error": "Video not found"}), 404
    _ensure_video_columns()
    db.session.execute(
        text("""
        UPDATE videos
        SET title = COALESCE(:title, title),
            description = COALESCE(:description, description),
            is_published = COALESCE(:is_published, is_published),
            updated_at = :ts
        WHERE id = :id
    """),
        {
            "title": title,
            "description": description,
            "is_published": is_published,
            "ts": datetime.utcnow().isoformat(),
            "id": video_id,
        },
    )
    db.session.commit()
    row = db.session.execute(
        text("""
        SELECT v.*,
               u.username AS author_name,
               u.avatar_url AS author_avatar,
               u.premium AS author_premium,
               (SELECT COALESCE(SUM(count), 0) FROM video_views vv WHERE vv.video_id = v.id) AS views_calc,
               (SELECT COUNT(1) FROM video_likes vl WHERE vl.video_id = v.id) AS likes_calc
        FROM videos v
        LEFT JOIN users u ON u.id = v.author_id
        WHERE v.id = :id AND v.is_deleted = 0
    """),
        {"id": video_id},
    ).fetchone()
    if not row:
        return jsonify({"error": "Video not found"}), 404
    data = dict(row._mapping)
    data["views"] = int(data.get("views_calc") or 0)
    data["likes"] = int(data.get("likes_calc") or 0)
    return jsonify(data), 200


@videos_bp.route("/<video_id>", methods=["DELETE"])
@token_required
def delete_video(current_user, video_id):
    row = db.session.execute(
        text(f"""
        SELECT id FROM videos WHERE id = :id AND author_id = :author_id AND {_cond_is_deleted()}
    """),
        {"id": video_id, "author_id": current_user.id},
    ).fetchone()
    if not row:
        return jsonify({"error": "Video not found"}), 404
    db.session.execute(
        text("""
        UPDATE videos SET is_deleted = 1, updated_at = :ts WHERE id = :id
    """),
        {"id": video_id, "ts": datetime.utcnow().isoformat()},
    )
    db.session.commit()
    return jsonify({"ok": True}), 200


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
    allow_comments = data.get("allow_comments")
    is_nsfw = data.get("is_nsfw") or False
    has_profanity = data.get("has_profanity") or False
    is_published = data.get("is_published")
    if allow_comments is None:
        allow_comments = True
    if is_published is None:
        is_published = True
    if not title or not url:
        return jsonify({"error": "title and url are required"}), 400
    v_id = (
        data.get("id")
        or os.popen('powershell -NoProfile -Command "[guid]::NewGuid().ToString()"')
        .read()
        .strip()
        or None
    )
    if not v_id:
        v_id = os.urandom(16).hex()
    try:
        _ensure_video_columns()
        db.session.execute(
            text("""
            INSERT INTO videos (id, author_id, title, description, url, poster, duration, created_at, updated_at, views, likes, is_deleted, tags, allow_comments, is_nsfw, has_profanity, is_published)
            VALUES (:id, :author_id, :title, :description, :url, :poster, :duration, :created_at, :updated_at, 0, 0, 0, :tags, :allow_comments, :is_nsfw, :has_profanity, :is_published)
        """),
            {
                "id": v_id,
                "author_id": current_user.id,
                "title": title,
                "description": description,
                "url": url,
                "poster": poster,
                "duration": duration,
                "created_at": datetime.utcnow().isoformat(),
                "updated_at": datetime.utcnow().isoformat(),
                "tags": None
                if tags is None
                else (tags if isinstance(tags, str) else str(tags)),
                "allow_comments": allow_comments,
                "is_nsfw": is_nsfw,
                "has_profanity": has_profanity,
                "is_published": is_published,
            },
        )
        db.session.commit()
        return jsonify(
            {
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
                "allow_comments": allow_comments,
                "is_nsfw": is_nsfw,
                "has_profanity": has_profanity,
                "is_published": is_published,
                "author_name": getattr(current_user, "username", None),
                "author_avatar": getattr(current_user, "avatar_url", None),
                "author_premium": getattr(current_user, "premium", 0),
            }
        ), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 400


@videos_bp.route("/check", methods=["POST"])
@token_required
def check_video(current_user):
    data = request.get_json() or {}
    video_url = data.get("video_url") or data.get("url")
    if not video_url:
        return jsonify({"error": "video_url is required"}), 400
    parsed = urlparse(video_url)
    path = parsed.path if parsed.scheme else str(video_url)
    if not path.startswith("/static/"):
        return jsonify({"error": "Unsupported video path"}), 400
    file_path = os.path.join(current_app.root_path, path.lstrip("/"))
    if not os.path.isfile(file_path):
        return jsonify({"error": "Video file not found"}), 404
    try:
        _ensure_video_checks_table()
        job_id = str(uuid.uuid4())
        ts = datetime.utcnow().isoformat()
        db.session.execute(
            text("""
            INSERT INTO video_checks (id, video_url, file_path, status, result_json, error, created_at, updated_at)
            VALUES (:id, :video_url, :file_path, :status, NULL, NULL, :ts, :ts)
        """),
            {
                "id": job_id,
                "video_url": str(video_url),
                "file_path": file_path,
                "status": "queued",
                "ts": ts,
            },
        )
        db.session.commit()
        try:
            _publish_video_check(job_id, file_path, str(video_url))
        except Exception as e:
            db.session.execute(
                text("""
                UPDATE video_checks SET status = :status, error = :error, updated_at = :ts
                WHERE id = :id
            """),
                {
                    "status": "error",
                    "error": str(e),
                    "ts": datetime.utcnow().isoformat(),
                    "id": job_id,
                },
            )
            db.session.commit()
            return jsonify({"error": str(e)}), 500
        return jsonify({"job_id": job_id, "status": "queued"}), 202
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@videos_bp.route("/check/<job_id>", methods=["GET"])
@token_required
def check_video_status(current_user, job_id):
    _ensure_video_checks_table()
    row = db.session.execute(
        text("""
        SELECT id, status, result_json, error
        FROM video_checks
        WHERE id = :id
    """),
        {"id": job_id},
    ).fetchone()
    if not row:
        return jsonify({"error": "Job not found"}), 404
    payload = {
        "job_id": row[0],
        "status": row[1],
        "error": row[3],
    }
    if row[2]:
        try:
            payload["result"] = json.loads(row[2])
        except Exception:
            payload["result"] = row[2]
    return jsonify(payload), 200


@videos_bp.route("/view", methods=["POST"])
@token_required
def register_view(current_user):
    _ensure_video_views_table()
    data = request.get_json() or {}
    video_id = data.get("video_id")
    if not video_id:
        return jsonify({"error": "video_id is required"}), 400

    ip = _get_ip()

    # 1. Per-account: count only once
    existing_user_row = db.session.execute(
        text("SELECT id FROM video_views WHERE video_id = :vid AND user_id = :uid"), {
            "vid": video_id, "uid": current_user.id}, ).fetchone()
    if existing_user_row:
        return jsonify({"ok": True, "counted": False,
                        "reason": "already_counted_for_user"}), 200

    # 2. IP cap: do not count more than 3 per IP per video
    ip_total_row = db.session.execute(
        text(
            "SELECT SUM(count) as total FROM video_views WHERE video_id = :vid AND ip = :ip"
        ),
        {"vid": video_id, "ip": ip},
    ).fetchone()
    ip_total = int((ip_total_row[0] or 0)) if ip_total_row else 0
    if ip_total >= 3:
        return jsonify({"ok": True, "counted": False,
                       "reason": "ip_cap_reached"}), 200

    try:
        # Insert per-user view row
        db.session.execute(
            text("""
            INSERT INTO video_views (video_id, user_id, ip, count, last_viewed_at)
            VALUES (:vid, :uid, :ip, 1, :ts)
        """),
            {
                "vid": video_id,
                "uid": current_user.id,
                "ip": ip,
                "ts": datetime.utcnow().isoformat(),
            },
        )

        _sync_video_views(video_id)

        # Track per-user history in users.video_history (TEXT JSON)
        try:
            hist_row = db.session.execute(
                text("SELECT video_history FROM users WHERE id = :uid"),
                {"uid": current_user.id},
            ).fetchone()
            payload = hist_row[0] if hist_row else None
            items = []
            if payload:
                try:
                    import json

                    items = json.loads(payload) or []
                except Exception:
                    items = []
            # remove existing
            items = [x for x in items if isinstance(
                x, dict) and x.get("id") != video_id]
            # prepend new
            items.insert(
                0, {"id": video_id, "ts": datetime.utcnow().isoformat()})
            # cap to 200
            items = items[:200]
            import json

            db.session.execute(
                text("UPDATE users SET video_history = :val WHERE id = :uid"),
                {"val": json.dumps(items, ensure_ascii=False),
                 "uid": current_user.id},
            )
        except Exception:
            pass

        db.session.commit()
        return jsonify({"ok": True, "counted": True}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 400


def _toggle_user_list_column(
        user_id: str,
        column: str,
        video_id: str,
        add: bool):
    import json

    # read
    row = db.session.execute(
        text(f"SELECT {column} FROM users WHERE id = :uid"), {"uid": user_id}
    ).fetchone()
    payload = row[0] if row else None
    arr = []
    if payload:
        try:
            arr = json.loads(payload) or []
        except Exception:
            arr = []
    # normalize to list of ids
    if isinstance(arr, list):
        arr = [
            x["id"]
            if isinstance(x, dict) and "id" in x
            else (x if isinstance(x, str) else str(x))
            for x in arr
        ]
    else:
        arr = []
    if add:
        if video_id not in arr:
            arr.insert(0, video_id)
    else:
        arr = [x for x in arr if x != video_id]
    db.session.execute(
        text(f"UPDATE users SET {column} = :val WHERE id = :uid"),
        {"val": json.dumps(arr, ensure_ascii=False), "uid": user_id},
    )


@videos_bp.route("/like", methods=["POST"])
@token_required
def like_toggle(current_user):
    data = request.get_json() or {}
    video_id = data.get("video_id")
    action = (data.get("action") or "like").lower()
    if not video_id:
        return jsonify({"error": "video_id is required"}), 400
    try:
        _ensure_video_likes_table()
        if action == "unlike":
            db.session.execute(
                text("DELETE FROM video_likes WHERE video_id = :vid AND user_id = :uid"), {
                    "vid": video_id, "uid": current_user.id}, )
            _toggle_user_list_column(
                current_user.id, "video_likes", video_id, False)
        else:
            if db.engine.dialect.name == "sqlite":
                db.session.execute(
                    text("""
                    INSERT OR IGNORE INTO video_likes (video_id, user_id, created_at)
                    VALUES (:vid, :uid, :ts)
                """),
                    {
                        "vid": video_id,
                        "uid": current_user.id,
                        "ts": datetime.utcnow().isoformat(),
                    },
                )
            else:
                db.session.execute(
                    text("""
                    INSERT INTO video_likes (video_id, user_id, created_at)
                    VALUES (:vid, :uid, :ts)
                    ON CONFLICT (video_id, user_id) DO NOTHING
                """),
                    {
                        "vid": video_id,
                        "uid": current_user.id,
                        "ts": datetime.utcnow().isoformat(),
                    },
                )
            _toggle_user_list_column(
                current_user.id, "video_likes", video_id, True)
        likes = _sync_video_likes(video_id)
        db.session.commit()
        return jsonify({"ok": True, "likes": likes}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 400


@videos_bp.route("/liked", methods=["GET"])
@token_required
def liked_list(current_user):
    _ensure_video_likes_table()
    rows = db.session.execute(
        text("""
        SELECT video_id FROM video_likes WHERE user_id = :uid ORDER BY created_at DESC
    """),
        {"uid": current_user.id},
    ).fetchall()
    ids = [str(r[0]) for r in rows] if rows else []
    if not ids:
        return jsonify([]), 200
    placeholders = ",".join([":id" + str(i) for i in range(len(ids))])
    params = {("id" + str(i)): ids[i] for i in range(len(ids))}
    sql = f"""
        SELECT v.*, u.username AS author_name, u.avatar_url AS author_avatar, u.premium AS author_premium
        FROM videos v
        LEFT JOIN users u ON u.id = v.author_id
        WHERE v.id IN ({placeholders})
    """
    rows = db.session.execute(text(sql), params).fetchall()
    by_id = {r._mapping["id"]: dict(r._mapping) for r in rows}
    result = [by_id[i] for i in ids if i in by_id]
    return jsonify(result), 200


@videos_bp.route("/later", methods=["POST"])
@token_required
def later_toggle(current_user):
    data = request.get_json() or {}
    video_id = data.get("video_id")
    action = (data.get("action") or "add").lower()
    if not video_id:
        return jsonify({"error": "video_id is required"}), 400
    try:
        _toggle_user_list_column(
            current_user.id, "video_watch_later", video_id, action != "remove"
        )
        db.session.commit()
        return jsonify({"ok": True}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 400


@videos_bp.route("/later", methods=["GET"])
@token_required
def later_list(current_user):
    import json

    row = db.session.execute(
        text("SELECT video_watch_later FROM users WHERE id = :uid"),
        {"uid": current_user.id},
    ).fetchone()
    payload = row[0] if row else None
    ids = []
    if payload:
        try:
            data = json.loads(payload) or []
            if isinstance(data, list):
                ids = [str(x) for x in data]
        except Exception:
            ids = []
    if not ids:
        return jsonify([]), 200
    placeholders = ",".join([":id" + str(i) for i in range(len(ids))])
    params = {("id" + str(i)): ids[i] for i in range(len(ids))}
    sql = f"""
        SELECT v.*, u.username AS author_name, u.avatar_url AS author_avatar, u.premium AS author_premium
        FROM videos v
        LEFT JOIN users u ON u.id = v.author_id
        WHERE v.id IN ({placeholders})
    """
    rows = db.session.execute(text(sql), params).fetchall()
    items = [dict(r._mapping) for r in rows]
    return jsonify(items), 200


@videos_bp.route("/history", methods=["GET"])
@token_required
def history_list(current_user):
    import json

    row = db.session.execute(
        text("SELECT video_history FROM users WHERE id = :uid"),
        {"uid": current_user.id},
    ).fetchone()
    payload = row[0] if row else None
    items = []
    if payload:
        try:
            data = json.loads(payload) or []
            if isinstance(data, list):
                items = [x for x in data if isinstance(
                    x, dict) and x.get("id")]
        except Exception:
            items = []
    ids = [x["id"] for x in items]
    if not ids:
        return jsonify([]), 200
    placeholders = ",".join([":id" + str(i) for i in range(len(ids))])
    params = {("id" + str(i)): ids[i] for i in range(len(ids))}
    sql = f"""
        SELECT v.*, u.username AS author_name, u.avatar_url AS author_avatar, u.premium AS author_premium
        FROM videos v
        LEFT JOIN users u ON u.id = v.author_id
        WHERE v.id IN ({placeholders})
    """
    rows = db.session.execute(text(sql), params).fetchall()
    by_id = {r._mapping["id"]: dict(r._mapping) for r in rows}
    # preserve order
    result = [by_id[i] for i in ids if i in by_id]
    return jsonify(result), 200


# Simple video comments table ensure and endpoints


def _ensure_video_comments_table():
    try:
        if db.engine.dialect.name == "sqlite":
            cols = db.session.execute(
                text("PRAGMA table_info(video_comments)")
            ).fetchall()
            if not cols:
                db.session.execute(
                    text("""
                    CREATE TABLE video_comments (
                        id TEXT PRIMARY KEY,
                        video_id TEXT NOT NULL,
                        posted_by TEXT NOT NULL,
                        content TEXT NOT NULL,
                        created_at TEXT,
                        likes INTEGER DEFAULT 0,
                        deleted INTEGER DEFAULT 0
                    )
                """)
                )
                db.session.commit()
        else:
            db.session.execute(
                text("""
                CREATE TABLE IF NOT EXISTS video_comments (
                    id TEXT PRIMARY KEY,
                    video_id TEXT NOT NULL,
                    posted_by TEXT NOT NULL,
                    content TEXT NOT NULL,
                    created_at TEXT,
                    likes INTEGER DEFAULT 0,
                    deleted INTEGER DEFAULT 0
                )
            """)
            )
            db.session.commit()
    except Exception:
        pass


@videos_bp.route("/comments/<video_id>", methods=["GET"])
def get_video_comments(video_id):
    _ensure_video_comments_table()
    rows = db.session.execute(
        text("""
        SELECT vc.*, u.username AS author_name, u.avatar_url AS author_avatar
        FROM video_comments vc
        LEFT JOIN users u ON u.id = vc.posted_by
        WHERE vc.video_id = :vid AND vc.deleted = 0
        ORDER BY vc.created_at ASC
    """),
        {"vid": video_id},
    ).fetchall()
    items = [dict(r._mapping) for r in rows]
    return jsonify(items), 200


@videos_bp.route("/comments", methods=["POST"])
@token_required
def create_video_comment(current_user):
    _ensure_video_comments_table()
    _ensure_video_columns()
    data = request.get_json() or {}
    video_id = data.get("video_id")
    content = (data.get("content") or "").strip()
    if not video_id or not content:
        return jsonify({"error": "video_id and content are required"}), 400
    import os

    cid = (
        os.popen(
            'powershell -NoProfile -Command "[guid]::NewGuid().ToString()"')
        .read()
        .strip()
        or os.urandom(16).hex()
    )
    try:
        row = db.session.execute(
            text("""
            SELECT allow_comments FROM videos WHERE id = :vid
        """),
            {"vid": video_id},
        ).fetchone()
        if not row:
            return jsonify({"error": "Video not found"}), 404
        allow_comments_value = row[0]
        allow_comments_enabled = bool(allow_comments_value)
        if isinstance(allow_comments_value, str):
            allow_comments_enabled = allow_comments_value.lower() not in (
                "0",
                "false",
                "f",
            )
        if not allow_comments_enabled:
            return jsonify({"error": "Comments are disabled"}), 403
        db.session.execute(
            text("""
            INSERT INTO video_comments (id, video_id, posted_by, content, created_at, likes, deleted)
            VALUES (:id, :vid, :uid, :content, :ts, 0, 0)
        """),
            {
                "id": cid,
                "vid": video_id,
                "uid": current_user.id,
                "content": content,
                "ts": datetime.utcnow().isoformat(),
            },
        )
        db.session.commit()
        return jsonify(
            {
                "id": cid,
                "video_id": video_id,
                "posted_by": current_user.id,
                "content": content,
            }
        ), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 400
