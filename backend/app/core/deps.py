from typing import Optional
from fastapi import Depends, Header, HTTPException, Query, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_async_session
from app.models.user import User
from app.services.auth_service import AuthService

security_bearer = HTTPBearer(auto_error=False)


# 1. DB Dependency Alias
async def get_async_db() -> AsyncSession:
    async for session in get_async_session():
        yield session


# 2. Token Extraction Dependency
async def get_token_from_request(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_bearer),
) -> Optional[str]:
    # 1. Header: Authorization: Bearer <token>
    if credentials and credentials.credentials:
        return credentials.credentials.strip()

    # 2. Query param: access_token
    token = request.query_params.get("access_token")
    if token:
        return token.strip()

    # 3. Cookie: access_token
    token = request.cookies.get("access_token")
    if token:
        return token.strip()

    # 4. JSON body if available
    try:
        body = await request.json()
        if isinstance(body, dict) and body.get("access_token"):
            return str(body["access_token"]).strip()
    except Exception:
        pass

    return None


# 3. Current User Dependency using AuthService
async def get_current_user(
    token: Optional[str] = Depends(get_token_from_request),
    db: AsyncSession = Depends(get_async_db),
) -> User:
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="access_token is missing",
        )

    user, error = AuthService.get_user_by_token(token)
    if error or not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=error or "Invalid or expired token",
        )

    if hasattr(user, "check_and_clean_expired_premium"):
        user.check_and_clean_expired_premium()

    if getattr(user, "is_blocked", 0):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account blocked by administrator",
        )

    if getattr(user, "is_blocked_system", 0):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account temporarily locked by security system",
        )

    return user


# 4. Optional Current User Dependency
async def get_optional_current_user(
    token: Optional[str] = Depends(get_token_from_request),
    db: AsyncSession = Depends(get_async_db),
) -> Optional[User]:
    if not token:
        return None
    try:
        return await get_current_user(token=token, db=db)
    except HTTPException:
        return None


# 5. Current Admin User Dependency
async def get_current_admin_user(
    current_user: User = Depends(get_current_user),
) -> User:
    if getattr(current_user, "role", "") != "Admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Administrator access required",
        )
    return current_user


# 6. Pagination Parameters Dependency Class
class PaginationParams:
    def __init__(
        self,
        page: int = Query(1, ge=1, description="Page number starting from 1"),
        per_page: int = Query(20, ge=1, le=100, description="Items per page (max 100)"),
    ):
        self.page = page
        self.per_page = per_page
        self.offset = (page - 1) * per_page


# 7. Bot Token Dependency
async def get_bot_token(
    authorization: Optional[str] = Header(None),
    x_bot_token: Optional[str] = Header(None),
) -> Optional[str]:
    if authorization and authorization.startswith("Bot "):
        return authorization.replace("Bot ", "", 1).strip()
    if x_bot_token:
        return x_bot_token.strip()
    return None
