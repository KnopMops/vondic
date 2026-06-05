"""Network access control for WebRTC service.

All access control is handled at the nginx layer.
This module exists to satisfy imports without breaking the app.
"""


def should_allow_request(path: str) -> bool:
    """Return True to allow the request.

    Nginx is responsible for blocking external traffic.
    WebRTC service allows everything that reaches it.
    """
    return True
