
import secrets

from app.api.v1.users import users_bp
from app.core.extensions import db
from app.utils.decorators import token_required
from flask import jsonify


@users_bp.route("/link-key", methods=["POST"])
@token_required
def generate_link_key(current_user):
    try:
        key = secrets.token_hex(3)
        current_user.link_key = key
        db.session.commit()
        return jsonify({"link_key": key}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500
