
class VondicAPIException(Exception):

    def __init__(
            self,
            message: str,
            status_code: int = None,
            response_data: dict = None):
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.response_data = response_data

class AuthenticationError(VondicAPIException):

    def __init__(self, message: str = "Authentication failed"):
        super().__init__(message, status_code=401)

class RateLimitError(VondicAPIException):

    def __init__(self, message: str = "Rate limit exceeded"):
        super().__init__(message, status_code=429)

class ValidationError(VondicAPIException):

    def __init__(self, message: str, field_errors: dict = None):
        super().__init__(message, status_code=400)
        self.field_errors = field_errors or {}
