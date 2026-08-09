from fastapi import APIRouter

v2_proxy_router = APIRouter(prefix="/api/v2/proxy", tags=["Proxy v2"])


@v2_proxy_router.get("")
@v2_proxy_router.get("/")
async def proxy_status():
    return {"status": "ok"}
