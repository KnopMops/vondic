"""File handling for BotikSDK — InputFile, send helpers."""
import base64
import os
from typing import Optional


class InputFile:
    """Represents a file to be sent — wraps local path or bytes into base64."""
    def __init__(self, path: str = None, filename: str = None, file_bytes: bytes = None):
        self.path = path
        self.filename = filename or (os.path.basename(path) if path else None)
        self._file_bytes = file_bytes

    def to_base64(self) -> str:
        if self._file_bytes:
            return base64.b64encode(self._file_bytes).decode()
        if self.path:
            with open(self.path, "rb") as f:
                return base64.b64encode(f.read()).decode()
        raise ValueError("No file content")

    def to_dict(self) -> dict:
        return {"file": self.to_base64(), "filename": self.filename}
