"""V2 Batch API — execute multiple requests in one HTTP call."""
import logging
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from flask import Blueprint, request, jsonify, g
from app.api.v2.errors import validation_error, internal_error

logger = logging.getLogger(__name__)

v2_batch_bp = Blueprint("v2_batch", __name__, url_prefix="/api/v2")

MAX_BATCH_SIZE = 10
MAX_WORKERS = 4


def _execute_sub_request(req_data, base_url, auth_header):
    """Execute a single sub-request within a batch."""
    import requests as http_requests

    method = (req_data.get("method") or "GET").upper()
    path = req_data.get("path", "")
    body = req_data.get("body")
    params = req_data.get("params")

    if not path:
        return {"status": 400, "body": {"error": "path is required"}}

    url = f"{base_url}{path}"
    headers = {}
    if auth_header:
        headers["Authorization"] = auth_header

    try:
        kwargs = {"headers": headers, "timeout": 10}
        if body and method in ("POST", "PUT", "PATCH"):
            kwargs["json"] = body
        if params:
            kwargs["params"] = params

        resp = http_requests.request(method, url, **kwargs)

        try:
            body = resp.json()
        except Exception:
            body = resp.text[:500]

        return {"status": resp.status_code, "body": body}
    except Exception as e:
        return {"status": 500, "body": {"error": str(e)[:200]}}


@v2_batch_bp.route("/batch", methods=["POST"])
def execute_batch():
    """Execute multiple API requests in parallel."""
    try:
        data = request.get_json() or {}
        requests_list = data.get("requests", [])

        if not requests_list:
            return validation_error("requests array is required")
        if len(requests_list) > MAX_BATCH_SIZE:
            return validation_error(
                f"Maximum {MAX_BATCH_SIZE} requests per batch",
                field="requests",
                value=len(requests_list),
            )

        base_url = f"http://localhost:{os.environ.get('PORT', 5050)}"
        auth_header = request.headers.get("Authorization", "")

        t0 = time.time()
        results = [None] * len(requests_list)

        with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
            future_to_idx = {}
            for i, req_data in enumerate(requests_list):
                future = executor.submit(
                    _execute_sub_request, req_data, base_url, auth_header
                )
                future_to_idx[future] = i

            for future in as_completed(future_to_idx):
                idx = future_to_idx[future]
                results[idx] = future.result()

        elapsed = time.time() - t0

        return jsonify({
            "results": results,
            "meta": {
                "count": len(results),
                "elapsed_ms": round(elapsed * 1000),
            }
        }), 200

    except Exception as e:
        logger.exception("batch_error")
        return internal_error(str(e)[:200])


import os
