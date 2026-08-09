from fastapi import APIRouter

v2_analytics_router = APIRouter(prefix="/api/public/v2/bots", tags=["Analytics v2"])


@v2_analytics_router.get("/{bot_id}/analytics")
async def bot_analytics(bot_id: str):
    return {"bot_id": bot_id, "analytics": {}}
