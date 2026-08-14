import logging
import aioboto3
from botocore.config import Config
from app.core.config import settings

logger = logging.getLogger(__name__)


async def upload_file_to_s3(
    file_bytes: bytes,
    key: str,
    content_type: str = "application/octet-stream"
) -> str:
    """Асинхронная загрузка файла в S3 MinIO через aioboto3."""
    session = aioboto3.Session()
    client_config = Config(signature_version="s3v4")

    try:
        async with session.client(
            "s3",
            endpoint_url=settings.S3_ENDPOINT,
            aws_access_key_id=settings.S3_ACCESS_KEY,
            aws_secret_access_key=settings.S3_SECRET_KEY,
            region_name=settings.S3_REGION,
            config=client_config,
        ) as s3_client:
            await s3_client.put_object(
                Bucket=settings.S3_BUCKET,
                Key=key,
                Body=file_bytes,
                ContentType=content_type,
            )
            return f"{settings.S3_PUBLIC_URL}/uploads/{key}"
    except Exception as e:
        logger.error(f"S3 upload error for key '{key}': {e}", exc_info=True)
        raise RuntimeError(f"Failed to upload file to S3: {e}")
