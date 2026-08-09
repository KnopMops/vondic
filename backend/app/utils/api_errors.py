from fastapi.responses import JSONResponse


def api_error(code: str, status: int):
    """Return a standardized JSON error response."""
    return JSONResponse(status_code=status, content={"error": code})
