"""V2 API unified error format and error codes."""
from flask import jsonify, make_response
import uuid
import time


ERROR_CODES = {
    400: "VALIDATION_ERROR",
    401: "AUTH_REQUIRED",
    403: "PERMISSION_DENIED",
    404: "NOT_FOUND",
    409: "CONFLICT",
    429: "RATE_LIMITED",
    500: "INTERNAL_ERROR",
}


def api_error(status_code, message, details=None):
    """Create a v2 format error response."""
    code = ERROR_CODES.get(status_code, "INTERNAL_ERROR")
    body = {
        "error": {
            "code": code,
            "message": message,
            "details": details or {},
        },
        "request_id": f"req_{uuid.uuid4().hex[:12]}",
        "timestamp": int(time.time()),
    }
    return make_response(jsonify(body), status_code)


def validation_error(message, field=None, value=None):
    """400 Validation Error."""
    details = {}
    if field:
        details["field"] = field
    if value is not None:
        details["value"] = str(value)[:200]
    return api_error(400, message, details)


def auth_required(message="Authentication required"):
    """401 Auth Required."""
    return api_error(401, message)


def permission_denied(message="Insufficient permissions"):
    """403 Permission Denied."""
    return api_error(403, message)


def not_found(message="Resource not found"):
    """404 Not Found."""
    return api_error(404, message)


def conflict(message="Resource already exists"):
    """409 Conflict."""
    return api_error(409, message)


def rate_limited(retry_after=60):
    """429 Rate Limited."""
    resp = api_error(429, f"Rate limit exceeded. Try again in {retry_after}s")
    resp.headers["Retry-After"] = str(retry_after)
    return resp


def internal_error(message="Internal server error"):
    """500 Internal Error."""
    return api_error(500, message)
