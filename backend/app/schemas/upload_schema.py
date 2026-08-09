from typing import Optional
from pydantic import BaseModel


class UploadResponseSchema(BaseModel):
    url: str
    size: int
    disk_usage: int
    storage: str = "s3"
    message: Optional[str] = None
    original_filename: Optional[str] = None
    ext: Optional[str] = None


class Base64FileUploadSchema(BaseModel):
    file: str
    filename: str
