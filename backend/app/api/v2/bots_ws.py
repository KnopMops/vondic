from fastapi import APIRouter

v2_bot_ws_router = APIRouter(prefix="/api/public/v2/bots", tags=["Bot WS v2"])


@v2_bot_ws_router.get("/{bot_id}/ws-info")
async def get_ws_info(bot_id: str):
    return {"bot_id": bot_id, "websocket_url": f"wss://vondic.ru/ws/bots/{bot_id}"}
