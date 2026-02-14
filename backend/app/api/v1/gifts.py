from app.models.gift_catalog import GiftCatalog
from flask import Blueprint, jsonify

gifts_bp = Blueprint("gifts", __name__, url_prefix="/api/v1/gifts")


@gifts_bp.route("/", methods=["GET"])
def list_gifts():
    gifts = GiftCatalog.query.order_by(GiftCatalog.coin_price.asc()).all()
    return jsonify([g.to_dict() for g in gifts])
