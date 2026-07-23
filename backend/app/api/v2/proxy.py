"""V2 API proxy — forwards unimplemented v2 endpoints to v1."""
import logging
import requests
import os
from flask import Blueprint, request, jsonify, Response

logger = logging.getLogger(__name__)

v2_proxy_bp = Blueprint("v2_proxy", __name__)

BACKEND_URL = os.environ.get("BACKEND_URL", "http://localhost:5050")


@v2_proxy_bp.route("/<path:path>", methods=["GET", "POST", "PUT", "DELETE", "PATCH"])
def proxy_to_v1(path):
    """Proxy any v2 request to the corresponding v1 endpoint."""
    # Map v2 public paths to v1 public paths
    target_url = f"{BACKEND_URL}/api/public/v1/{path}"
    
    # Build headers
    headers = {}
    for key, value in request.headers:
        if key.lower() not in ("host", "content-length", "transfer-encoding"):
            headers[key] = value
    headers["X-API-Proxy"] = "v2"  # Bypass v1 deprecation block

    # Build query params
    params = dict(request.args)

    try:
        resp = requests.request(
            method=request.method,
            url=target_url,
            headers=headers,
            params=params,
            json=request.get_json(silent=True),
            timeout=30,
        )

        # Forward response with v2 deprecation header
        excluded_headers = [
            "content-encoding", "content-length", "transfer-encoding",
            "connection",
        ]
        response_headers = {
            k.lower(): v
            for k, v in resp.headers.items()
            if k.lower() not in excluded_headers
        }
        response_headers["x-api-version"] = "v2"
        response_headers["x-api-proxy"] = "v1"

        return Response(
            resp.content,
            status=resp.status_code,
            headers=response_headers,
        )

    except Exception as e:
        logger.exception("v2_proxy_error path=%s error=%s", path, e)
        return jsonify({"error": "Proxy error", "detail": str(e)[:200]}), 502
