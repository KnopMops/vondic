from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict, EmailStr, Field


class UserRegisterSchema(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    email: EmailStr
    password: str = Field(..., min_length=6)


class UserLoginSchema(BaseModel):
    email_or_username: str
    password: str


class TokenResponseSchema(BaseModel):
    access_token: str
    refresh_token: Optional[str] = None
    token_type: str = "bearer"
    user: Dict[str, Any]


class UserProfileUpdateSchema(BaseModel):
    username: Optional[str] = None
    description: Optional[str] = None
    avatar_url: Optional[str] = None
    profile_bg_theme: Optional[str] = None
    profile_bg_gradient: Optional[str] = None
    profile_bg_image: Optional[str] = None
    privacy_settings: Optional[Dict[str, Any]] = None


class UserResponseSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    username: str
    email: str
    role: str = "User"
    status: str = "offline"
    balance: float = 0.0
    bonus_balance: float = 0.0
    avatar_url: Optional[str] = None
    description: Optional[str] = None
    is_verified: bool = False
    premium: bool = False
    disk_usage: int = 0
    disk_limit: int = 536870912
    privacy_settings: Optional[Dict[str, Any]] = None
    created_at: Optional[str] = None
