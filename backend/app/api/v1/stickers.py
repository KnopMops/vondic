import uuid
from app.core.extensions import db
from app.models.sticker import StickerPack, Sticker
from app.utils.decorators import token_required
from flask import Blueprint, jsonify, request

stickers_bp = Blueprint("stickers", __name__, url_prefix="/api/v1/sticker-packs")


@stickers_bp.route("", methods=["GET"])
@token_required
def list_packs(current_user):
    packs = StickerPack.query.order_by(StickerPack.is_official.desc()).all()
    return jsonify([p.to_dict() for p in packs])


@stickers_bp.route("", methods=["POST"])
@token_required
def create_pack(current_user):
    data = request.get_json() or {}
    name = (data.get("name") or "").strip()
    if not name:
        return jsonify({"error": "name required"}), 400
    pack = StickerPack(id=uuid.uuid4().hex[:12], name=name, creator_id=str(current_user.id),
                        icon_url=data.get("icon_url"))
    db.session.add(pack)
    db.session.commit()
    return jsonify(pack.to_dict()), 201


@stickers_bp.route("/<pack_id>", methods=["DELETE"])
@token_required
def delete_pack(current_user, pack_id):
    pack = StickerPack.query.get(pack_id)
    if not pack:
        return jsonify({"error": "Not found"}), 404
    db.session.delete(pack)
    db.session.commit()
    return jsonify({"ok": True})


@stickers_bp.route("/<pack_id>/stickers", methods=["POST"])
@token_required
def add_sticker(current_user, pack_id):
    pack = StickerPack.query.get(pack_id)
    if not pack:
        return jsonify({"error": "Not found"}), 404
    data = request.get_json() or {}
    image_url = data.get("image_url")
    if not image_url:
        return jsonify({"error": "image_url required"}), 400
    pos = len(pack.stickers)
    sticker = Sticker(id=uuid.uuid4().hex[:12], pack_id=pack_id, image_url=image_url,
                       emoji=data.get("emoji"), position=pos)
    db.session.add(sticker)
    db.session.commit()
    return jsonify(sticker.to_dict()), 201


@stickers_bp.route("/<pack_id>/stickers/<sticker_id>", methods=["DELETE"])
@token_required
def delete_sticker(current_user, pack_id, sticker_id):
    sticker = Sticker.query.filter_by(id=sticker_id, pack_id=pack_id).first()
    if not sticker:
        return jsonify({"error": "Not found"}), 404
    db.session.delete(sticker)
    db.session.commit()
    return jsonify({"ok": True})
