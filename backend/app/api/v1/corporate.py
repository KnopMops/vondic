import hashlib
import secrets
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Request, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_async_session
from app.models.corporate_instance import CorporateInstance

corporate_router = APIRouter(prefix="/api/v1/corporate", tags=["Corporate"])

# Static public key for verifying corporate instances
# This key is embedded in the corporate version and verified here
CORPORATE_PUBLIC_KEY = "vondic-corp-pub-2024-secure-key-xK9mP2vL8nQ4wR7t"


class CorporateRegisterRequest(BaseModel):
    instance_uuid: str
    secret_key: str
    public_key: str
    domain: str | None = None
    company_name: str | None = None


class CorporateRegisterResponse(BaseModel):
    api_key: str
    instance_id: str
    message: str


@corporate_router.post("/register", response_model=CorporateRegisterResponse)
async def register_corporate_instance(
    payload: CorporateRegisterRequest,
    request: Request,
):
    """Register a new corporate instance and return an API key."""
    from app.core.database import AsyncSessionLocal

    async with AsyncSessionLocal() as db:
        # Verify public key
        if payload.public_key != CORPORATE_PUBLIC_KEY:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Invalid public key",
            )

        # Validate inputs
        if not payload.instance_uuid or not payload.secret_key:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="instance_uuid and secret_key are required",
            )

        # Check if instance already registered
        result = await db.execute(
            select(CorporateInstance).where(
                CorporateInstance.instance_uuid == payload.instance_uuid
            )
        )
        existing = result.scalar_one_or_none()

        if existing:
            # Instance already registered - verify secret key
            secret_hash = hashlib.sha256(payload.secret_key.encode()).hexdigest()
            if existing.secret_key_hash != secret_hash:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Invalid secret key for existing instance",
                )

            # Update last seen
            existing.last_seen_at = datetime.now(timezone.utc)
            if payload.domain:
                existing.domain = payload.domain
            if payload.company_name:
                existing.company_name = payload.company_name
            await db.commit()

            return CorporateRegisterResponse(
                api_key=existing.api_key,
                instance_id=existing.id,
                message="Instance re-authenticated successfully",
            )

        # New instance - generate API key
        api_key = f"vcorp_{secrets.token_urlsafe(48)}"
        secret_hash = hashlib.sha256(payload.secret_key.encode()).hexdigest()

        instance = CorporateInstance(
            instance_uuid=payload.instance_uuid,
            secret_key_hash=secret_hash,
            api_key=api_key,
            domain=payload.domain,
            company_name=payload.company_name,
        )
        db.add(instance)
        await db.commit()
        await db.refresh(instance)

        return CorporateRegisterResponse(
            api_key=api_key,
            instance_id=instance.id,
            message="Corporate instance registered successfully",
        )


@corporate_router.post("/verify")
async def verify_corporate_instance(
    request: Request,
):
    """Verify that a corporate API key is valid."""
    from app.core.database import AsyncSessionLocal

    auth_header = request.headers.get("Authorization", "")
    api_key = auth_header.replace("Bearer ", "").strip()

    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="API key required",
        )

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(CorporateInstance).where(
                CorporateInstance.api_key == api_key,
                CorporateInstance.is_active == True,
            )
        )
        instance = result.scalar_one_or_none()

        if not instance:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or inactive API key",
            )

        # Update last seen
        instance.last_seen_at = datetime.now(timezone.utc)
        await db.commit()

        return {
            "valid": True,
            "instance_id": instance.id,
            "company_name": instance.company_name,
            "domain": instance.domain,
        }
