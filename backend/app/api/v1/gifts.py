import re
import uuid

from app.core.extensions import db
from app.models.gift_catalog import GiftCatalog
from app.utils.decorators import token_required
from flask import Blueprint, jsonify, request

gifts_bp = Blueprint("gifts", __name__, url_prefix="/api/v1/gifts")


@gifts_bp.route("/", methods=["GET"])
def list_gifts():
    try:
        gifts = GiftCatalog.query.order_by(GiftCatalog.coin_price.asc()).all()
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    return jsonify([g.to_dict() for g in gifts])


def _generate_gift_id(name: str) -> str:
    raw = (name or "").strip().lower()
    base = re.sub(r"\s+", "_", raw)
    base = re.sub(r"[^a-z0-9_]+", "", base)
    if not base:
        base = "gift"
    if not GiftCatalog.query.get(base):
        return base
    suffix = uuid.uuid4().hex[:6]
    return f"{base}_{suffix}"


@gifts_bp.route("/admin/create", methods=["POST"])
@token_required
def create_gift(current_user):
    if getattr(current_user, "role", "") != "Admin":
        return jsonify({"error": "Forbidden"}), 403
    data = request.get_json() or {}
    name = (data.get("name") or "").strip()
    coin_price = data.get("coin_price")
    icon = (data.get("icon") or "").strip() or None
    description = (data.get("description") or "").strip() or None
    image_url = (data.get("image_url") or "").strip() or None
    total_supply = data.get("total_supply")
    if not name:
        return jsonify({"error": "name is required"}), 400
    try:
        price_int = int(coin_price) if coin_price is not None else 0
    except Exception:
        return jsonify({"error": "coin_price must be integer"}), 400
    try:
        supply_value = (
            int(total_supply)
            if total_supply is not None and total_supply != ""
            else None
        )
        if supply_value is not None and supply_value <= 0:
            return jsonify({"error": "total_supply must be positive"}), 400
    except Exception:
        return jsonify({"error": "total_supply must be integer"}), 400
    gid = data.get("id") or _generate_gift_id(name)
    if GiftCatalog.query.get(gid):
        return jsonify({"error": "gift with this id already exists"}), 400
    gift = GiftCatalog(
        id=gid,
        name=name,
        coin_price=price_int,
        icon=icon,
        description=description,
        image_url=image_url,
        total_supply=supply_value,
    )
    try:
        db.session.add(gift)
        db.session.commit()
        return jsonify({"gift": gift.to_dict()}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


@gifts_bp.route("/admin/update", methods=["POST"])
@token_required
def update_gift(current_user):
    if getattr(current_user, "role", "") != "Admin":
        return jsonify({"error": "Forbidden"}), 403
    data = request.get_json() or {}
    gid = data.get("id")
    if not gid:
        return jsonify({"error": "id is required"}), 400
    gift = GiftCatalog.query.get(gid)
    if not gift:
        return jsonify({"error": "Gift not found"}), 404
    if "name" in data:
        name = (data.get("name") or "").strip()
        if name:
            gift.name = name
    if "coin_price" in data:
        try:
            gift.coin_price = int(data.get("coin_price"))
        except Exception:
            return jsonify({"error": "coin_price must be integer"}), 400
    if "icon" in data:
        icon = (data.get("icon") or "").strip() or None
        gift.icon = icon
    if "description" in data:
        description = (data.get("description") or "").strip() or None
        gift.description = description
    if "image_url" in data:
        image_url = (data.get("image_url") or "").strip() or None
        gift.image_url = image_url
    if "total_supply" in data:
        total_supply = data.get("total_supply")
        try:
            supply_value = (
                int(total_supply)
                if total_supply is not None and total_supply != ""
                else None
            )
            if supply_value is not None and supply_value <= 0:
                return jsonify({"error": "total_supply must be positive"}), 400
        except Exception:
            return jsonify({"error": "total_supply must be integer"}), 400
        gift.total_supply = supply_value
    try:
        db.session.commit()
        return jsonify({"gift": gift.to_dict()}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


@gifts_bp.route("/admin/delete", methods=["POST"])
@token_required
def delete_gift(current_user):
    if getattr(current_user, "role", "") != "Admin":
        return jsonify({"error": "Forbidden"}), 403
    data = request.get_json() or {}
    gid = data.get("id")
    if not gid:
        return jsonify({"error": "id is required"}), 400
    gift = GiftCatalog.query.get(gid)
    if not gift:
        return jsonify({"error": "Gift not found"}), 404
    try:
        db.session.delete(gift)
        db.session.commit()
        return jsonify({"success": True}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500
