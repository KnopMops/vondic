"""V2 API package — Flask blueprint registration."""
from flask import Blueprint

# V2 public API — for bots, embeddable widgets, third-party integrations
v2_public_bp = Blueprint("v2_public", __name__, url_prefix="/api/public/v2")

# V2 internal API — for the main app (authenticated)
v2_bp = Blueprint("v2", __name__, url_prefix="/api/v2")
