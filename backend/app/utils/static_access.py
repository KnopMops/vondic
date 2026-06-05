"""Static file access control for backend.

All access control is handled at the nginx layer.
This module exists to satisfy imports without breaking the app.
"""


def authorize_static_request() -> bool:
    """Return True to allow the request.

    Nginx is responsible for blocking external traffic.
    Backend allows everything that reaches it.
    """
    return True
