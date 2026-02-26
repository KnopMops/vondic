"""
Custom exceptions for the Vondic API Client Library.
"""


class VondicAPIException(Exception):
    """
    Base exception for Vondic API errors.
    """

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
    """
    Exception raised for authentication-related errors.
    """

    def __init__(self, message: str = "Authentication failed"):
        super().__init__(message, status_code=401)


class RateLimitError(VondicAPIException):
    """
    Exception raised when API rate limit is exceeded.
    """

    def __init__(self, message: str = "Rate limit exceeded"):
        super().__init__(message, status_code=429)


class ValidationError(VondicAPIException):
    """
    Exception raised for validation errors.
    """

    def __init__(self, message: str, field_errors: dict = None):
        super().__init__(message, status_code=400)
        self.field_errors = field_errors or {}
