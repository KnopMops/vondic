class BotikSDKError(Exception):
    pass

class APIError(BotikSDKError):
    def __init__(self, status_code, message, payload=None):
        super().__init__(message)
        self.status_code = status_code
        self.payload = payload

class UnauthorizedError(APIError):
    pass

class NotFoundError(APIError):
    pass

class BadRequestError(APIError):
    pass
