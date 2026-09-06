"""API key authentication for Public API v2.

Supports two auth modes:
  1. Bot token:  Authorization: Bot <token>  or  X-Bot-Token: <token>
  2. API key:    X-API-Key: <key>  or  Authorization: Bearer <key>

The API key is the user-level key generated via /api/public/v1/account/api-key.
Bot tokens are generated per-bot via /api/public/v1/bots/{id}/token.
"""
import logging
from typing import Optional

from fastapi import Depends, Header, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_async_session
from app.models.bot import Bot
from app.models.user import User
from app.services.bot_service import BotService
from app.services.user_service import UserService

logger = logging.getLogger(__name__)


async def _get_async_db():
    async for session in get_async_session():
        yield session


def _extract_api_key(
    x_api_key: Optional[str] = Header(None),
    authorization: Optional[str] = Header(None),
) -> Optional[str]:
    if x_api_key:
        return x_api_key.strip()
    if authorization and authorization.startswith("Bearer ") and not authorization.startswith("Bot "):
        return authorization.replace("Bearer ", "", 1).strip()
    return None


def _extract_bot_token(
    authorization: Optional[str] = Header(None),
    x_bot_token: Optional[str] = Header(None),
) -> Optional[str]:
    if authorization and authorization.startswith("Bot "):
        return authorization.replace("Bot ", "", 1).strip()
    if x_bot_token:
        return x_bot_token.strip()
    return None


async def get_api_key_user(
    api_key: Optional[str] = Depends(_extract_api_key),
    db: AsyncSession = Depends(_get_async_db),
) -> User:
    """Authenticate via API key and return the owning user."""
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="API key required. Pass X-API-Key header or Authorization: Bearer <key>",
        )

    # Try to find user by API key hash
    user = UserService.get_user_by_api_key(api_key)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired API key",
        )

    if getattr(user, "is_blocked", 0):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account blocked",
        )

    return user


async def get_bot_or_api_key_user(
    bot_token: Optional[str] = Depends(_extract_bot_token),
    api_key: Optional[str] = Depends(_extract_api_key),
    db: AsyncSession = Depends(_get_async_db),
) -> dict:
    """Authenticate via either bot token or API key.

    Returns dict with keys:
      - auth_type: "bot" | "api_key"
      - bot_id: str (only for bot auth)
      - user: User object (only for api_key auth)
      - user_id: str
    """
    # Try bot token first
    if bot_token:
        # Bot tokens are in format: bot_token_{bot_id} or raw token
        # We need to verify against the bot's stored hash
        from sqlalchemy import text
        try:
            result = await db.execute(
                select(Bot).where(Bot.is_active == 1)
            )
            bots = result.scalars().all()
            for bot in bots:
                if bot.bot_token_hash and BotService.verify_bot_token(str(bot.id), bot_token):
                    return {
                        "auth_type": "bot",
                        "bot_id": str(bot.id),
                        "user_id": str(bot.owner_id) if bot.owner_id else str(bot.id),
                        "user": None,
                    }
        except Exception as e:
            logger.warning("Bot token verification error: %s", e)

    # Try API key
    if api_key:
        user = UserService.get_user_by_api_key(api_key)
        if user and not getattr(user, "is_blocked", 0):
            return {
                "auth_type": "api_key",
                "bot_id": None,
                "user_id": str(user.id),
                "user": user,
            }

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Authentication required. Pass X-API-Key, Authorization: Bearer <key>, or Authorization: Bot <token>",
    )
