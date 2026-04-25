import json
import os
import uuid
from datetime import datetime
from urllib.parse import urlparse

from app.core.extensions import db
from app.models.user import User
from app.models.video import Video
from app.models.video_check import VideoCheck
from app.models.video_comment import VideoComment
from app.models.video_like import VideoLike
from app.models.video_view import VideoView
from app.utils.decorators import token_required
from flask import Blueprint, current_app, jsonify, request

videos_bp = Blueprint("videos", __name__, url_prefix="/api/v1/videos")


def _get_ip() -> str:
    ip = request.headers.get("X-Forwarded-For") or request.remote_addr or ""
    if isinstance(ip, str) and "," in ip:
        ip = ip.split(",", 1)[0].strip()
    return ip


def _serialize_video(video: Video):
    author = User.query.get(video.author_id)
    return {
        "id": video.id,
        "author_id": video.author_id,
        "title": video.title,
        "description": video.description,
        "url": video.url,
        "poster": video.poster,
        "duration": video.duration,
        "created_at": video.created_at.isoformat() if video.created_at else None,
        "updated_at": video.updated_at.isoformat() if video.updated_at else None,
        "views": int(video.views or 0),
        "likes": int(video.likes or 0),
        "is_deleted": bool(video.is_deleted),
        "tags": video.tags,
        "allow_comments": bool(video.allow_comments),
        "is_nsfw": bool(video.is_nsfw),
        "has_profanity": bool(video.has_profanity),
        "is_published": bool(video.is_published),
        "author_name": getattr(author, "username", None),
        "author_avatar": getattr(author, "avatar_url", None),
        "author_premium": getattr(author, "premium", 0),
    }


def _sync_video_views(video_id: str):
    views = VideoView.query.filter_by(video_id=video_id).count()
    video = Video.query.get(video_id)
    if video:
        video.views = views
    return views


def _sync_video_likes(video_id: str):
    likes = VideoLike.query.filter_by(video_id=video_id).count()
    video = Video.query.get(video_id)
    if video:
        video.likes = likes
    return likes


def _toggle_user_list_column(
        user_id: str,
        column: str,
        video_id: str,
        add: bool):
    user = User.query.get(user_id)
    if not user:
        return
    payload = getattr(user, column, None)
    arr = []
    if payload:
        try:
            arr = json.loads(payload) or []
        except Exception:
            arr = []
    if isinstance(arr, list):
        arr = [
            x["id"] if isinstance(
                x, dict) and "id" in x else (
                x if isinstance(
                    x, str) else str(x)) for x in arr]
    else:
        arr = []
    if add:
        if video_id not in arr:
            arr.insert(0, video_id)
    else:
        arr = [x for x in arr if x != video_id]
    setattr(user, column, json.dumps(arr, ensure_ascii=False))


def _publish_video_check(job_id: str, file_path: str, video_url: str):
    import pika

    rabbit_url = os.environ.get("RABBITMQ_URL",
                                "amqp://guest:guest@localhost:5672/%2F")
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


@videos_bp.route("/", methods=["GET"])
def list_videos():
    sort = (request.args.get("sort") or "created_at").lower()
    order = (request.args.get("order") or "desc").lower()
    limit = int(request.args.get("limit") or 24)
    offset = int(request.args.get("offset") or 0)
    user_id = request.args.get("user_id")
    shorts = request.args.get("shorts")

    query = Video.query.filter_by(is_deleted=False, is_published=True)
    if user_id:
        query = query.filter_by(author_id=user_id)
    if shorts in ("1", "true", "yes"):
        query = query.filter(
            (Video.duration.is_(None)) | (
                Video.duration <= 60))
    if sort == "views":
        query = query.order_by(
            Video.views.asc() if order == "asc" else Video.views.desc())
    elif sort == "likes":
        query = query.order_by(
            Video.likes.asc() if order == "asc" else Video.likes.desc())
    else:
        query = query.order_by(
            Video.created_at.asc() if order == "asc" else Video.created_at.desc())

    rows = query.offset(offset).limit(limit).all()
    return jsonify([_serialize_video(v) for v in rows]), 200


@videos_bp.route("/<video_id>", methods=["GET"])
def get_video(video_id):
    video = Video.query.get(video_id)
    if not video or video.is_deleted:
        return jsonify({"error": "Video not found"}), 404
    if not video.is_published:
        return jsonify({"error": "Video not found"}), 404
    return jsonify(_serialize_video(video)), 200


@videos_bp.route("/my", methods=["GET"])
@token_required
def list_my_videos(current_user):
    sort = (request.args.get("sort") or "created_at").lower()
    order = (request.args.get("order") or "desc").lower()
    limit = int(request.args.get("limit") or 100)
    offset = int(request.args.get("offset") or 0)

    query = Video.query.filter_by(author_id=current_user.id, is_deleted=False)
    if sort == "views":
        query = query.order_by(
            Video.views.asc() if order == "asc" else Video.views.desc())
    elif sort == "likes":
        query = query.order_by(
            Video.likes.asc() if order == "asc" else Video.likes.desc())
    else:
        query = query.order_by(
            Video.created_at.asc() if order == "asc" else Video.created_at.desc())
    rows = query.offset(offset).limit(limit).all()
    return jsonify([_serialize_video(v) for v in rows]), 200


@videos_bp.route("/<video_id>", methods=["PATCH"])
@token_required
def update_video(current_user, video_id):
    data = request.get_json() or {}
    title = data.get("title")
    description = data.get("description")
    is_published = data.get("is_published")
    if title is not None and not str(title).strip():
        return jsonify({"error": "title cannot be empty"}), 400

    video = Video.query.filter_by(
        id=video_id,
        author_id=current_user.id,
        is_deleted=False).first()
    if not video:
        return jsonify({"error": "Video not found"}), 404
    if title is not None:
        video.title = title
    if description is not None:
        video.description = description
    if is_published is not None:
        video.is_published = bool(is_published)
    video.updated_at = datetime.utcnow()
    db.session.commit()
    return jsonify(_serialize_video(video)), 200


@videos_bp.route("/<video_id>", methods=["DELETE"])
@token_required
def delete_video(current_user, video_id):
    video = Video.query.filter_by(
        id=video_id,
        author_id=current_user.id,
        is_deleted=False).first()
    if not video:
        return jsonify({"error": "Video not found"}), 404
    video.is_deleted = True
    video.updated_at = datetime.utcnow()
    db.session.commit()
    return jsonify({"ok": True}), 200


@videos_bp.route("/", methods=["POST"])
@token_required
def create_video(current_user):
    data = request.get_json() or {}
    title = data.get("title")
    url = data.get("url")
    if not title or not url:
        return jsonify({"error": "title and url are required"}), 400
    video = Video(
        id=data.get("id") or str(
            uuid.uuid4()),
        author_id=current_user.id,
        title=title,
        description=data.get("description"),
        url=url,
        poster=data.get("poster"),
        duration=data.get("duration"),
        tags=None if data.get("tags") is None else (
            data.get("tags") if isinstance(
                data.get("tags"),
                str) else str(
                    data.get("tags"))),
        allow_comments=bool(
            data.get(
                "allow_comments",
                True)),
        is_nsfw=bool(
            data.get("is_nsfw") or False),
        has_profanity=bool(
            data.get("has_profanity") or False),
        is_published=bool(
            data.get(
                "is_published",
                True)),
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    try:
        db.session.add(video)
        db.session.commit()
        return jsonify(_serialize_video(video)), 201
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

    file_path = os.path.join(current_app.root_path,
                             "static", path[len("/static/"):])
    if not os.path.isfile(file_path):
        return jsonify({"error": "Video file not found"}), 404
    try:
        job = VideoCheck(
            id=str(uuid.uuid4()),
            video_url=str(video_url),
            file_path=file_path,
            status="queued",
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        db.session.add(job)
        db.session.commit()
        try:
            _publish_video_check(job.id, file_path, str(video_url))
        except Exception as e:
            job.status = "error"
            job.error = str(e)
            job.updated_at = datetime.utcnow()
            db.session.commit()
            return jsonify({"error": str(e)}), 500
        return jsonify({"job_id": job.id, "status": "queued"}), 202
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@videos_bp.route("/check/<job_id>", methods=["GET"])
@token_required
def check_video_status(current_user, job_id):
    row = VideoCheck.query.get(job_id)
    if not row:
        return jsonify({"error": "Job not found"}), 404
    payload = {
        "job_id": row.id,
        "status": row.status,
        "error": row.error,
    }
    if row.result:
        try:
            payload["result"] = json.loads(row.result)
        except Exception:
            payload["result"] = row.result
    return jsonify(payload), 200


@videos_bp.route("/view", methods=["POST"])
@token_required
def register_view(current_user):
    data = request.get_json() or {}
    video_id = data.get("video_id")
    if not video_id:
        return jsonify({"error": "video_id is required"}), 400

    ip = _get_ip()
    existing_user_row = VideoView.query.filter_by(
        video_id=video_id, user_id=current_user.id).first()
    if existing_user_row:
        return jsonify({"ok": True, "counted": False,
                       "reason": "already_counted_for_user"}), 200

    ip_total = (
        db.session.query(db.func.coalesce(db.func.sum(VideoView.count), 0))
        .filter_by(video_id=video_id, ip=ip)
        .scalar()
    ) or 0
    if int(ip_total) >= 3:
        return jsonify({"ok": True, "counted": False,
                       "reason": "ip_cap_reached"}), 200

    try:
        db.session.add(
            VideoView(
                video_id=video_id,
                user_id=current_user.id,
                ip=ip,
                count=1,
                created_at=datetime.utcnow(),
            )
        )
        _sync_video_views(video_id)
        try:
            payload = current_user.video_history
            items = []
            if payload:
                try:
                    items = json.loads(payload) or []
                except Exception:
                    items = []
            items = [
                x for x in items if isinstance(
                    x, dict) and x.get("id") != video_id]
            items.insert(
                0, {"id": video_id, "ts": datetime.utcnow().isoformat()})
            current_user.video_history = json.dumps(
                items[:200], ensure_ascii=False)
        except Exception:
            pass
        db.session.commit()
        return jsonify({"ok": True, "counted": True}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 400


@videos_bp.route("/like", methods=["POST"])
@token_required
def like_toggle(current_user):
    data = request.get_json() or {}
    video_id = data.get("video_id")
    action = (data.get("action") or "like").lower()
    if not video_id:
        return jsonify({"error": "video_id is required"}), 400
    try:
        if action == "unlike":
            VideoLike.query.filter_by(
                video_id=video_id,
                user_id=current_user.id).delete(
                synchronize_session=False)
            _toggle_user_list_column(
                current_user.id, "video_likes", video_id, False)
        else:
            existing = VideoLike.query.filter_by(
                video_id=video_id, user_id=current_user.id).first()
            if not existing:
                db.session.add(
                    VideoLike(
                        video_id=video_id,
                        user_id=current_user.id,
                        created_at=datetime.utcnow(),
                    )
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
    rows = (
        Video.query.join(
            VideoLike,
            VideoLike.video_id == Video.id) .filter(
            VideoLike.user_id == current_user.id,
            Video.is_deleted.is_(False),
            Video.is_published.is_(True)) .order_by(
                VideoLike.created_at.desc()) .all())
    return jsonify([_serialize_video(v) for v in rows]), 200


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
            current_user.id,
            "video_watch_later",
            video_id,
            action != "remove")
        db.session.commit()
        return jsonify({"ok": True}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 400


@videos_bp.route("/later", methods=["GET"])
@token_required
def later_list(current_user):
    payload = current_user.video_watch_later
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
    rows = Video.query.filter(
        Video.id.in_(ids),
        Video.is_deleted.is_(False),
        Video.is_published.is_(True)).all()
    by_id = {r.id: r for r in rows}
    items = [_serialize_video(by_id[i]) for i in ids if i in by_id]
    return jsonify(items), 200


@videos_bp.route("/history", methods=["GET"])
@token_required
def history_list(current_user):
    payload = current_user.video_history
    items = []
    if payload:
        try:
            data = json.loads(payload) or []
            if isinstance(data, list):
                items = [
                    x for x in data if isinstance(
                        x, dict) and x.get("id")]
        except Exception:
            items = []
    ids = [x["id"] for x in items]
    if not ids:
        return jsonify([]), 200
    rows = Video.query.filter(
        Video.id.in_(ids),
        Video.is_deleted.is_(False),
        Video.is_published.is_(True)).all()
    by_id = {r.id: r for r in rows}
    result = [_serialize_video(by_id[i]) for i in ids if i in by_id]
    return jsonify(result), 200


@videos_bp.route("/comments/<video_id>", methods=["GET"])
def get_video_comments(video_id):
    rows = VideoComment.query.filter_by(
        video_id=video_id).order_by(
        VideoComment.created_at.desc()).all()
    items = [
        {
            "id": r.id,
            "video_id": r.video_id,
            "posted_by": r.posted_by,
            "content": r.content,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in rows
    ]
    return jsonify(items), 200


@videos_bp.route("/comments", methods=["POST"])
@token_required
def create_video_comment(current_user):
    data = request.get_json() or {}
    video_id = data.get("video_id")
    content = (data.get("content") or "").strip()
    if not video_id or not content:
        return jsonify({"error": "video_id and content are required"}), 400
    try:
        video = Video.query.filter_by(id=video_id, is_deleted=False).first()
        if not video:
            return jsonify({"error": "Video not found"}), 404
        if not bool(video.allow_comments):
            return jsonify({"error": "Comments are disabled"}), 403
        comment = VideoComment(
            id=str(uuid.uuid4()),
            video_id=video_id,
            posted_by=current_user.id,
            content=content,
            created_at=datetime.utcnow(),
        )
        db.session.add(comment)
        db.session.commit()
        return jsonify(
            {
                "id": comment.id,
                "video_id": video_id,
                "posted_by": current_user.id,
                "content": content,
            }
        ), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 400
