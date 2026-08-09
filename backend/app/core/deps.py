from typing import Optional
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_async_session
from app.models.user import User

security_bearer = HTTPBearer(auto_error=False)


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


async def get_current_user(
    token: Optional[str] = Depends(get_token_from_request),
    db: AsyncSession = Depends(get_async_session),
) -> User:
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="access_token is missing",
        )

    # Find user by access_token or access_token_lookup
    stmt = select(User).where(
        (User.access_token == token) | (User.access_token_lookup == token)
    )
    result = await db.execute(stmt)
    user = result.scalars().first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )

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


async def get_optional_current_user(
    token: Optional[str] = Depends(get_token_from_request),
    db: AsyncSession = Depends(get_async_session),
) -> Optional[User]:
    if not token:
        return None
    try:
        return await get_current_user(token=token, db=db)
    except HTTPException:
        return None
