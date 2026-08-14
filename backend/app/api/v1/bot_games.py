from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Form, status
from fastapi.responses import FileResponse

from app.core.deps import get_current_user
from app.services.bot_game_service import BotGameService

bot_games_router = APIRouter(prefix="/api/v1/bots", tags=["Bot Games"])


@bot_games_router.get("/{bot_id}/games")
async def list_bot_games(
    bot_id: str,
    q: Optional[str] = Query(None),
    manage: Optional[str] = Query(None),
    current_user=Depends(get_current_user)
):
    bot = BotGameService.get_bot(bot_id)
    if not bot:
        raise HTTPException(status_code=404, detail="Bot not found")

    published_only = not (manage == "1" and BotGameService.can_manage_bot(
        bot, str(current_user.id), getattr(current_user, "role", None)))
    games = BotGameService.list_games(bot_id, query=q, published_only=published_only)
    return {"games": [BotGameService.serialize(g) for g in games], "bot_id": bot_id}


@bot_games_router.post("/{bot_id}/games", status_code=status.HTTP_201_CREATED)
async def upload_bot_game(
    bot_id: str,
    file: UploadFile = File(...),
    title: Optional[str] = Form(None),
    description: Optional[str] = Form(None),
    current_user=Depends(get_current_user)
):
    bot = BotGameService.get_bot(bot_id)
    if not bot:
        raise HTTPException(status_code=404, detail="Bot not found")

    if not BotGameService.can_manage_bot(bot, str(current_user.id), getattr(current_user, "role", None)):
        raise HTTPException(status_code=403, detail="Forbidden")

    zip_bytes = await file.read()
    if not zip_bytes:
        raise HTTPException(status_code=400, detail="Empty ZIP archive")

    game, error = BotGameService.create_from_zip(
        bot_id,
        str(current_user.id),
        title or file.filename or "Game",
        description,
        zip_bytes
    )
    if error or not game:
        raise HTTPException(status_code=400, detail=error or "Failed to upload game")

    return {"game": BotGameService.serialize(game), "message": "Game uploaded"}
