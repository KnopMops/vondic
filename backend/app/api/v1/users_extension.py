
import secrets

from app.core.extensions import db
from app.utils.decorators import token_required
from flask import jsonify


@users_bp.route("/link-key", methods=["POST"])
@token_required
def generate_link_key(current_user):
    """
    Generate a temporary link key for Telegram integration
    ---
    tags:
      - Users
    security:
      - Bearer: []
    responses:
      200:
        description: Link key generated
        schema:
            type: object
            properties:
                link_key:
                    type: string
    """
    try:
        # Generate a 6-digit code or short string
        key = secrets.token_hex(3) # 6 chars
        current_user.link_key = key
        db.session.commit()
        return jsonify({"link_key": key}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500
