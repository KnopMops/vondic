import aiohttp
from typing import Any, Dict, Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.core.deps import get_current_admin_user, get_optional_current_user
from app.services.call_routing_service import CallRoutingService

call_routing_router = APIRouter(prefix="/api/v1/call-routing", tags=["Call Routing"])


class CallRoutingUpdateSchema(BaseModel):
    settings: Optional[Dict[str, Any]] = None


class CallRoutingTestSchema(BaseModel):
    url: str


@call_routing_router.get("")
@call_routing_router.get("/")
async def get_call_routing():
    """Public endpoint for clients to get active call routing & ICE configuration."""
    settings = await CallRoutingService.get_routing_settings()
    return {"ok": True, "settings": settings}


@call_routing_router.get("/admin")
async def get_call_routing_admin(admin_user=Depends(get_current_admin_user)):
    """Admin endpoint to get call routing settings."""
    settings = await CallRoutingService.get_routing_settings()
    return {"ok": True, "settings": settings}


@call_routing_router.put("/admin")
async def update_call_routing_admin(
    payload: CallRoutingUpdateSchema,
    admin_user=Depends(get_current_admin_user),
):
    """Admin endpoint to update call routing settings."""
    patch = payload.settings or payload.model_dump(exclude_unset=True)
    try:
        updated = await CallRoutingService.update_routing_settings(patch)
        return {"ok": True, "settings": updated}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@call_routing_router.post("/admin/test")
async def test_endpoint_connectivity(
    payload: CallRoutingTestSchema,
    admin_user=Depends(get_current_admin_user),
):
    """Test accessibility of a signaling or media URL."""
    url = payload.url.strip()
    if not url:
        raise HTTPException(status_code=400, detail="URL is required")

    # If it's a stun or turn URL, we report that format is recognized
    if url.startswith("stun:") or url.startswith("turn:"):
        return {
            "ok": True,
            "type": "ice_server",
            "url": url,
            "status": "configured",
            "message": "Формат ICE сервера корректен",
        }

    # If HTTP/HTTPS URL, try to ping it with a short timeout
    target_url = url
    if not target_url.startswith("http://") and not target_url.startswith("https://"):
        target_url = f"https://{target_url}"

    try:
        timeout = aiohttp.ClientTimeout(total=5)
        async with aiohttp.ClientSession(timeout=timeout) as session:
            async with session.get(target_url, allow_redirects=True) as resp:
                return {
                    "ok": True,
                    "type": "http_service",
                    "url": target_url,
                    "status_code": resp.status,
                    "message": f"Сервер ответил со статусом {resp.status}",
                }
    except Exception as err:
        return {
            "ok": False,
            "type": "http_service",
            "url": target_url,
            "error": str(err),
            "message": f"Не удалось подключиться: {err}",
        }
