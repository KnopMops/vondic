import os
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Form, Request, status
from fastapi.responses import FileResponse, HTMLResponse, Response

from app.core.deps import get_current_user
from app.services.bot_game_service import BotGameService

bot_games_router = APIRouter(prefix="/api/v1/bots", tags=["Bot Games"])

_MIME_MAP = {
    ".html": "text/html",
    ".css": "text/css",
    ".js": "application/javascript",
    ".json": "application/json",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".svg": "image/svg+xml",
    ".webp": "image/webp",
    ".ico": "image/x-icon",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
    ".ttf": "font/ttf",
    ".mp3": "audio/mpeg",
    ".wav": "audio/wav",
    ".ogg": "audio/ogg",
    ".mp4": "video/mp4",
    ".webm": "video/webm",
}


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

    game, error = await BotGameService.create_from_zip(
        bot_id,
        str(current_user.id),
        title or file.filename or "Game",
        description,
        zip_bytes
    )
    if error or not game:
        raise HTTPException(status_code=400, detail=error or "Failed to upload game")

    return {"game": BotGameService.serialize(game), "message": "Game uploaded"}


async def _serve_game_file(bot_id: str, game_id: str, path: str = ""):
    """Shared logic: serve a game file or the entry HTML."""
    game = BotGameService.get_game(bot_id, game_id)
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")
    if not game.is_published:
        raise HTTPException(status_code=403, detail="Game not published")

    file_path = path or game.entry_path or "index.html"
    ext = os.path.splitext(file_path)[1].lower()
    media_type = _MIME_MAP.get(ext, "application/octet-stream" if path else "text/html")

    # Try local file first
    if not path:
        resolved = BotGameService.resolve_asset_path(game, game.entry_path or "index.html")
    else:
        resolved = BotGameService.resolve_asset_path(game, path)
    if resolved:
        return FileResponse(str(resolved), media_type=media_type)

    # S3 storage
    data = await BotGameService.get_asset_bytes(game, file_path)
    if data is None:
        raise HTTPException(status_code=404, detail="File not found")
    return Response(content=data, media_type=media_type)


@bot_games_router.get("/{bot_id}/games/{game_id}/embed")
async def embed_bot_game_root(bot_id: str, game_id: str):
    return await _serve_game_file(bot_id, game_id)


@bot_games_router.get("/{bot_id}/games/{game_id}/embed/{path:path}")
async def embed_bot_game_path(bot_id: str, game_id: str, path: str):
    return await _serve_game_file(bot_id, game_id, path)


@bot_games_router.get("/{bot_id}/games/{game_id}/asset/{path:path}")
async def serve_game_asset(bot_id: str, game_id: str, path: str):
    """Serve an individual game asset (CSS, JS, images, etc.)."""
    game = BotGameService.get_game(bot_id, game_id)
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")

    ext = os.path.splitext(path)[1].lower()
    media_type = _MIME_MAP.get(ext, "application/octet-stream")

    # Try local file first
    asset_path = BotGameService.resolve_asset_path(game, path)
    if asset_path:
        return FileResponse(str(asset_path), media_type=media_type)

    # S3 storage
    data = await BotGameService.get_asset_bytes(game, path)
    if data is None:
        raise HTTPException(status_code=404, detail="Asset not found")
    return Response(content=data, media_type=media_type)


@bot_games_router.get("/{bot_id}/games/{game_id}/download")
async def download_bot_game(bot_id: str, game_id: str):
    """Download the game as a ZIP archive."""
    game = BotGameService.get_game(bot_id, game_id)
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")

    zip_path = BotGameService.make_download_zip(game)
    if not zip_path or not zip_path.is_file():
        raise HTTPException(status_code=404, detail="Download not available")

    filename = f"{game.title or 'game'}.zip"
    return FileResponse(
        str(zip_path),
        media_type="application/zip",
        filename=filename,
    )
