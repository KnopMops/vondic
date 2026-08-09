import os
import time
import uuid
from typing import Optional, List

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel

v2_webhooks_router = APIRouter(prefix="/api/public/v2/bots", tags=["Webhooks v2"])


def _get_redis():
    import redis as redis_mod
    return redis_mod.Redis(
        host=os.environ.get("REDIS_HOST", "redis"),
        port=int(os.environ.get("REDIS_PORT", 6379)),
        db=0, decode_responses=True,
    )


class WebhookCreateSchema(BaseModel):
    url: str
    events: Optional[List[str]] = ["message"]
    secret: Optional[str] = ""


@v2_webhooks_router.get("/{bot_id}/webhooks")
async def list_webhooks(bot_id: str):
    r = _get_redis()
    webhook_ids = r.smembers(f"webhooks:{bot_id}") or set()
    webhooks = []
    for wid in webhook_ids:
        data = r.hgetall(f"webhook:{wid}")
        if data:
            data["id"] = wid
            data["events"] = data.get("events", "").split(",")
            webhooks.append(data)
    return {"webhooks": webhooks}


@v2_webhooks_router.post("/{bot_id}/webhooks", status_code=status.HTTP_201_CREATED)
async def create_webhook(bot_id: str, payload: WebhookCreateSchema):
    if not payload.url.startswith("http"):
        raise HTTPException(status_code=400, detail="url must start with http:// or https://")

    webhook_id = str(uuid.uuid4())[:12]
    r = _get_redis()

    r.hset(f"webhook:{webhook_id}", mapping={
        "id": webhook_id,
        "bot_id": bot_id,
        "url": payload.url,
        "events": ",".join(payload.events or ["message"]),
        "secret": payload.secret or "",
        "is_active": "1",
        "created_at": str(int(time.time())),
    })
    r.sadd(f"webhooks:{bot_id}", webhook_id)

    return {"ok": True, "webhook_id": webhook_id}


@v2_webhooks_router.delete("/{bot_id}/webhooks/{webhook_id}")
async def delete_webhook(bot_id: str, webhook_id: str):
    r = _get_redis()
    if not r.sismember(f"webhooks:{bot_id}", webhook_id):
        raise HTTPException(status_code=404, detail="Webhook not found")

    r.delete(f"webhook:{webhook_id}")
    r.srem(f"webhooks:{bot_id}", webhook_id)
    return {"ok": True}
