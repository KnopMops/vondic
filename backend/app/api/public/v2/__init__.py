"""Public API v2 — API-key authenticated endpoints for bots and integrations."""
from fastapi import APIRouter

public_v2_router = APIRouter(prefix="/api/public/v2", tags=["Public API v2"])
