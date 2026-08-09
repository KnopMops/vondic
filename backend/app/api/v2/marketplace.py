import os
from typing import Optional

from fastapi import APIRouter, HTTPException, Query

v2_marketplace_router = APIRouter(prefix="/api/public/v2/marketplace", tags=["Marketplace v2"])


def _get_redis():
    import redis as redis_mod
    return redis_mod.Redis(
        host=os.environ.get("REDIS_HOST", "redis"),
        port=int(os.environ.get("REDIS_PORT", 6379)),
        db=0, decode_responses=True,
    )


@v2_marketplace_router.get("/bots")
async def list_marketplace_bots(
    category: Optional[str] = Query(""),
    sort: Optional[str] = Query("popular"),
    limit: int = Query(20, ge=1, le=50),
    offset: int = Query(0, ge=0)
):
    try:
        r = _get_redis()
        if sort == "newest":
            bot_ids = r.zrevrange("marketplace:bots:created", offset, offset + limit - 1)
        elif sort == "rating":
            bot_ids = r.zrevrange("marketplace:bots:rating", offset, offset + limit - 1)
        else:
            bot_ids = r.zrevrange("marketplace:bots:installs", offset, offset + limit - 1)

        bots = []
        for bid in bot_ids:
            data = r.hgetall(f"marketplace:bot:{bid}")
            if data:
                data["id"] = bid
                data["installs"] = int(data.get("installs", 0))
                data["rating"] = float(data.get("rating", 0))
                if category and data.get("category") != category:
                    continue
                bots.append(data)

        total = r.zcard("marketplace:bots:installs") or 0
        return {"bots": bots, "total": total, "offset": offset, "limit": limit}
    except Exception as e:
        return {"bots": [], "total": 0, "offset": offset, "limit": limit}
