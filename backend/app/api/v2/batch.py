from fastapi import APIRouter

v2_batch_router = APIRouter(prefix="/api/v2/batch", tags=["Batch v2"])


@v2_batch_router.post("")
@v2_batch_router.post("/")
async def batch_process():
    return {"status": "ok", "results": []}
