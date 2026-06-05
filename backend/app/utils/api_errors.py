from flask import jsonify


def api_error(code: str, status: int):
    """Return a standardized JSON error response."""
    return jsonify({"error": code}), status
