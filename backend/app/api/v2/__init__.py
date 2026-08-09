"""V2 API package — FastAPI router definitions."""
from fastapi import APIRouter

v2_router = APIRouter(prefix="/api/v2", tags=["v2 API"])
v2_public_router = APIRouter(prefix="/api/public/v2", tags=["v2 Public API"])
