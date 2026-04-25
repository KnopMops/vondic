import uuid
import hashlib
import time
from datetime import datetime

from app.core.extensions import db
from app.models.notification import Notification
from app.models.playlist import Playlist
from app.models.playlist_borrow import PlaylistBorrow
from app.schemas.playlist_schema import playlist_schema, playlists_schema
from app.utils.decorators import token_required
from flask import Blueprint, jsonify, request

playlists_bp = Blueprint("playlists", __name__, url_prefix="/api/v1/playlists")


def _notify(
        user_id: str,
        title: str,
        message: str,
        notification_type: str = "system"):
    content_hash = hashlib.sha256(
        f"{user_id}|{title}|{message}|{time.time()}".encode("utf-8")
    ).hexdigest()
    notification = Notification(
        user_id=user_id,
        title=title,
        type=notification_type,
        message=message,
        notification_hash=content_hash,
        created_at=datetime.utcnow(),
    )
    db.session.add(notification)
    db.session.commit()


def _ensure_playlist_borrows_table():
    try:
        db.create_all()
    except Exception:
        db.session.rollback()


def _ensure_playlists_table():
    try:
        db.create_all()
    except Exception:
        db.session.rollback()


def _normalize_tracks(value):
    if isinstance(value, list):
        return value
    if isinstance(value, str):
        import json

        try:
            parsed = json.loads(value)
            return parsed if isinstance(parsed, list) else []
        except Exception:
            return []
    return []


def _playlist_payload(playlist: Playlist):
    data = playlist.to_dict()
    data["tracks"] = _normalize_tracks(playlist.tracks)
    data["track_count"] = len(data["tracks"])
    return data


@playlists_bp.route("/", methods=["GET"])
@token_required
def get_my_playlists(current_user):
    _ensure_playlists_table()
    _ensure_playlist_borrows_table()
    try:
        own = Playlist.query.filter_by(owner_id=current_user.id).all()
        borrows = PlaylistBorrow.query.filter_by(
            borrower_id=current_user.id).all()
        borrow_by_local = {b.local_playlist_id: b for b in borrows}
        borrowed_playlists = (
            Playlist.query.filter(
                Playlist.id.in_(
                    borrow_by_local.keys())).all() if borrow_by_local else [])
        all_playlists = own + borrowed_playlists
        all_playlists.sort(
            key=lambda p: p.created_at or datetime.min,
            reverse=True)
        playlists = []
        for playlist in all_playlists:
            d = _playlist_payload(playlist)
            borrow = borrow_by_local.get(playlist.id)
            d["borrowed"] = bool(borrow)
            if borrow:
                d["borrow_id"] = borrow.id
                d["borrow_status"] = borrow.status
                d["source_playlist_id"] = borrow.source_playlist_id
                d["source_owner_id"] = borrow.source_owner_id
            playlists.append(d)
        return jsonify(playlists), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@playlists_bp.route("/create", methods=["POST"])
@token_required
def create_playlist(current_user):
    _ensure_playlists_table()
    data = request.get_json() or {}
    name = data.get("name")
    description = data.get("description", "")
    cover_image = data.get("cover_image")
    is_public = data.get("is_public", True)
    is_pinned = data.get("is_pinned", False)
    tracks = data.get("tracks", [])

    if not name or not str(name).strip():
        return jsonify({"error": "Playlist name is required"}), 400

    try:
        playlist = Playlist(
            id=str(uuid.uuid4()),
            name=str(name).strip(),
            description=description,
            cover_image=cover_image,
            owner_id=current_user.id,
            is_public=bool(is_public),
            is_pinned=bool(is_pinned),
            tracks=tracks if isinstance(tracks, list) else [],
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        db.session.add(playlist)
        db.session.commit()
        return jsonify(_playlist_payload(playlist)), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


@playlists_bp.route("/<playlist_id>", methods=["GET"])
@token_required
def get_playlist(current_user, playlist_id):
    _ensure_playlists_table()
    try:
        playlist = Playlist.query.get(playlist_id)
        if not playlist:
            return jsonify({"error": "Playlist not found"}), 404

        is_public = bool(playlist.is_public)
        is_owner = playlist.owner_id == current_user.id

        if not is_public and not is_owner:
            return jsonify({"error": "Access denied"}), 403

        return jsonify(_playlist_payload(playlist)), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@playlists_bp.route("/<playlist_id>", methods=["PUT"])
@token_required
def update_playlist(current_user, playlist_id):
    _ensure_playlists_table()
    data = request.get_json() or {}

    try:
        playlist = Playlist.query.filter_by(
            id=playlist_id, owner_id=current_user.id).first()
        if not playlist:
            return jsonify(
                {"error": "Playlist not found or access denied"}), 404

        if "name" in data:
            if not str(data["name"]).strip():
                return jsonify({"error": "Playlist name cannot be empty"}), 400
            playlist.name = str(data["name"]).strip()
        if "description" in data:
            playlist.description = data["description"]
        if "cover_image" in data:
            playlist.cover_image = data["cover_image"]
        if "is_public" in data:
            playlist.is_public = bool(data["is_public"])
        if "is_pinned" in data:
            playlist.is_pinned = bool(data["is_pinned"])
        if "tracks" in data:
            playlist.tracks = data["tracks"] if isinstance(
                data["tracks"], list) else []

        if not any(
            k in data for k in (
                "name",
                "description",
                "cover_image",
                "is_public",
                "is_pinned",
                "tracks")):
            return jsonify({"error": "No fields to update"}), 400

        playlist.updated_at = datetime.utcnow()
        db.session.commit()
        return jsonify(_playlist_payload(playlist)), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


@playlists_bp.route("/<playlist_id>", methods=["DELETE"])
@token_required
def delete_playlist(current_user, playlist_id):
    _ensure_playlists_table()
    try:
        playlist = Playlist.query.filter_by(
            id=playlist_id, owner_id=current_user.id).first()
        if not playlist:
            return jsonify(
                {"error": "Playlist not found or access denied"}), 404

        db.session.delete(playlist)
        db.session.commit()

        return jsonify({"ok": True}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


@playlists_bp.route("/user/<user_id>/public", methods=["GET"])
def get_user_public_playlists(user_id):
    _ensure_playlists_table()
    try:
        rows = (
            Playlist.query.filter_by(owner_id=user_id, is_public=True)
            .order_by(Playlist.created_at.desc())
            .all()
        )
        return jsonify([_playlist_payload(row) for row in rows]), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@playlists_bp.route("/<playlist_id>/add-tracks", methods=["POST"])
@token_required
def add_tracks_to_playlist(current_user, playlist_id):
    _ensure_playlists_table()
    data = request.get_json() or {}
    new_tracks = data.get("tracks", [])

    if not new_tracks or not isinstance(new_tracks, list):
        return jsonify({"error": "tracks array is required"}), 400

    validated_tracks = []
    for idx, track in enumerate(new_tracks):
        if not isinstance(track, dict):
            return jsonify(
                {"error": f"Track at index {idx} must be an object"}), 400

        allowed_fields = {
            "id",
            "title",
            "artist",
            "original_id",
            "duration",
            "album",
            "url"}
        sanitized_track = {
            k: v for k, v in track.items() if k in allowed_fields and not (
                k == "url" and str(v).startswith("blob:"))}

        if not sanitized_track.get("id"):
            return jsonify(
                {"error": f"Track at index {idx} must have an 'id' field"}), 400

        validated_tracks.append(sanitized_track)

    try:
        playlist = Playlist.query.filter_by(
            id=playlist_id, owner_id=current_user.id).first()
        if not playlist:
            return jsonify(
                {"error": "Playlist not found or access denied"}), 404

        existing_tracks = _normalize_tracks(playlist.tracks)
        existing_tracks.extend(validated_tracks)
        playlist.tracks = existing_tracks
        playlist.updated_at = datetime.utcnow()
        db.session.commit()

        return jsonify({
            "id": playlist_id,
            "tracks": existing_tracks,
            "track_count": len(existing_tracks),
            "updated_at": playlist.updated_at.isoformat() if playlist.updated_at else None,
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


@playlists_bp.route("/<playlist_id>/remove-tracks", methods=["POST"])
@token_required
def remove_tracks_from_playlist(current_user, playlist_id):
    _ensure_playlists_table()
    data = request.get_json() or {}
    track_indices = data.get("indices", [])

    if not track_indices or not isinstance(track_indices, list):
        return jsonify({"error": "indices array is required"}), 400

    try:
        playlist = Playlist.query.filter_by(
            id=playlist_id, owner_id=current_user.id).first()
        if not playlist:
            return jsonify(
                {"error": "Playlist not found or access denied"}), 404

        existing_tracks = _normalize_tracks(playlist.tracks)
        for idx in sorted(track_indices, reverse=True):
            if 0 <= idx < len(existing_tracks):
                existing_tracks.pop(idx)

        playlist.tracks = existing_tracks
        playlist.updated_at = datetime.utcnow()
        db.session.commit()

        return jsonify({
            "id": playlist_id,
            "tracks": existing_tracks,
            "track_count": len(existing_tracks),
            "updated_at": playlist.updated_at.isoformat() if playlist.updated_at else None,
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


@playlists_bp.route("/borrow", methods=["POST"])
@token_required
def borrow_playlist(current_user):
    _ensure_playlists_table()
    _ensure_playlist_borrows_table()
    data = request.get_json() or {}
    source_playlist_id = str(data.get("source_playlist_id") or "").strip()
    if not source_playlist_id:
        return jsonify({"error": "source_playlist_id is required"}), 400

    source = Playlist.query.get(source_playlist_id)
    if not source:
        return jsonify({"error": "Source playlist not found"}), 404

    src_owner_id = str(source.owner_id or "")
    is_public = bool(source.is_public)
    if not is_public and src_owner_id != str(current_user.id):
        return jsonify({"error": "Access denied"}), 403

    src_tracks = _normalize_tracks(source.tracks)

    local_playlist_id = str(uuid.uuid4())
    borrow_id = str(uuid.uuid4())
    now = datetime.utcnow()
    name = str(source.name or "Плейлист").strip()
    description = source.description or "Позаимствованный плейлист"
    cover_image = source.cover_image

    try:
        local_playlist = Playlist(
            id=local_playlist_id,
            name=f"{name} (позаимств.)",
            description=description,
            cover_image=cover_image,
            owner_id=current_user.id,
            is_public=False,
            is_pinned=False,
            tracks=src_tracks,
            created_at=now,
            updated_at=now,
        )
        borrow = PlaylistBorrow(
            id=borrow_id,
            borrower_id=current_user.id,
            local_playlist_id=local_playlist_id,
            source_playlist_id=source_playlist_id,
            source_owner_id=src_owner_id,
            status="pending",
            auto_sync=False,
            created_at=now,
        )
        db.session.add(local_playlist)
        db.session.add(borrow)
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

    try:
        _notify(
            src_owner_id,
            "Запрос синхронизации плейлиста",
            f"Пользователь {
                current_user.username} хочет синхронизировать плейлист «{name}». Откройте VМьюзик → Запросы синхронизации.",
            "warning",
        )
    except Exception:
        pass

    return jsonify(
        {
            "id": local_playlist_id,
            "name": f"{name} (позаимств.)",
            "description": description,
            "cover_image": cover_image,
            "owner_id": current_user.id,
            "is_public": False,
            "is_pinned": False,
            "tracks": src_tracks,
            "track_count": len(src_tracks),
            "created_at": now.isoformat(),
            "updated_at": now.isoformat(),
            "borrowed": True,
            "borrow_id": borrow_id,
            "borrow_status": "pending",
            "source_playlist_id": source_playlist_id,
            "source_owner_id": src_owner_id,
        }
    ), 201


@playlists_bp.route("/borrow/requests", methods=["GET"])
@token_required
def borrow_requests(current_user):
    _ensure_playlists_table()
    _ensure_playlist_borrows_table()
    try:
        rows = (
            db.session.query(PlaylistBorrow, Playlist.name)
            .join(Playlist, Playlist.id == PlaylistBorrow.source_playlist_id)
            .filter(
                PlaylistBorrow.source_owner_id == current_user.id,
                PlaylistBorrow.status == "pending",
            )
            .order_by(PlaylistBorrow.created_at.desc())
            .all()
        )
        items = []
        for borrow, source_name in rows:
            items.append(
                {
                    "borrow_id": borrow.id,
                    "borrower_id": borrow.borrower_id,
                    "source_playlist_id": borrow.source_playlist_id,
                    "local_playlist_id": borrow.local_playlist_id,
                    "status": borrow.status,
                    "source_name": source_name,
                }
            )
        return jsonify({"items": items}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@playlists_bp.route("/borrow/requests/<borrow_id>/approve", methods=["POST"])
@token_required
def approve_borrow_request(current_user, borrow_id):
    _ensure_playlist_borrows_table()
    try:
        borrow = PlaylistBorrow.query.filter_by(
            id=borrow_id, source_owner_id=current_user.id).first()
        if not borrow:
            return jsonify({"error": "Request not found"}), 404
        if (borrow.status or "") != "pending":
            return jsonify({"error": "Request already processed"}), 400
        borrow.status = "approved"
        db.session.commit()
        borrower_id = str(borrow.borrower_id)
        try:
            _notify(
                borrower_id,
                "Синхронизация разрешена",
                "Владелец плейлиста одобрил синхронизацию. Теперь вы можете синхронизировать плейлист в VМьюзик.",
                "success",
            )
        except Exception:
            pass
        return jsonify({"ok": True, "status": "approved"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


@playlists_bp.route("/borrow/requests/<borrow_id>/reject", methods=["POST"])
@token_required
def reject_borrow_request(current_user, borrow_id):
    _ensure_playlist_borrows_table()
    try:
        borrow = PlaylistBorrow.query.filter_by(
            id=borrow_id, source_owner_id=current_user.id).first()
        if not borrow:
            return jsonify({"error": "Request not found"}), 404
        if (borrow.status or "") != "pending":
            return jsonify({"error": "Request already processed"}), 400
        borrow.status = "rejected"
        db.session.commit()
        borrower_id = str(borrow.borrower_id)
        try:
            _notify(
                borrower_id,
                "Синхронизация отклонена",
                "Владелец плейлиста отклонил синхронизацию.",
                "warning",
            )
        except Exception:
            pass
        return jsonify({"ok": True, "status": "rejected"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


@playlists_bp.route("/borrow/<local_playlist_id>/sync", methods=["POST"])
@token_required
def sync_borrowed_playlist(current_user, local_playlist_id):
    _ensure_playlists_table()
    _ensure_playlist_borrows_table()
    try:
        borrow = PlaylistBorrow.query.filter_by(
            local_playlist_id=local_playlist_id,
            borrower_id=current_user.id,
        ).first()
        if not borrow:
            return jsonify({"error": "Borrow record not found"}), 404
        if (borrow.status or "") != "approved":
            return jsonify({"error": "Sync not approved"}), 403

        source_playlist = Playlist.query.get(str(borrow.source_playlist_id))
        local_playlist = Playlist.query.get(local_playlist_id)
        if not source_playlist:
            return jsonify({"error": "Source playlist not found"}), 404
        if not local_playlist:
            return jsonify({"error": "Local playlist not found"}), 404
        tracks = _normalize_tracks(source_playlist.tracks)
        now = datetime.utcnow()
        local_playlist.tracks = tracks
        local_playlist.updated_at = now
        borrow.last_synced_at = now
        db.session.commit()

        try:
            _notify(
                current_user.id,
                "Плейлист синхронизирован",
                f"Плейлист обновлён: «{source_playlist.name or 'Плейлист'}».",
                "success",
            )
        except Exception:
            pass

        return jsonify({"ok": True, "tracks": tracks,
                       "updated_at": now.isoformat()}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500
