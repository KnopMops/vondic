from flask import Blueprint

from .v1 import public_v1_bp

public_bp = Blueprint("public", __name__)

public_bp.register_blueprint(public_v1_bp, url_prefix="/v1")
