import mimetypes
import os

from app.services.bot_game_service import BotGameService
from app.utils.decorators import token_required
from flask import Blueprint, Response, current_app, jsonify, request, send_file

bot_games_bp = Blueprint("bot_games", __name__)


@bot_games_bp.route("/<bot_id>/games", methods=["GET"])
@token_required
def list_bot_games(current_user, bot_id):
    bot = BotGameService.get_bot(bot_id)
    if not bot:
        return jsonify({"error": "Бот не найден"}), 404
    query = request.args.get("q") or request.args.get("query")
    manage = request.args.get("manage") == "1"
    published_only = not (
        manage
        and BotGameService.can_manage_bot(
            bot, str(current_user.id), getattr(current_user, "role", None)
        )
    )
    games = BotGameService.list_games(
        bot_id, query=query, published_only=published_only
    )
    return jsonify(
        {
            "games": [BotGameService.serialize(g) for g in games],
            "bot_id": bot_id,
        }
    ), 200


@bot_games_bp.route("/<bot_id>/games", methods=["POST"])
@token_required
def upload_bot_game(current_user, bot_id):
    bot = BotGameService.get_bot(bot_id)
    if not bot:
        return jsonify({"error": "Бот не найден"}), 404
    if not BotGameService.can_manage_bot(
        bot, str(current_user.id), getattr(current_user, "role", None)
    ):
        return jsonify(
            {"error": "Нет прав на загрузку игр для этого бота"}), 403

    upload = request.files.get("file")
    if not upload:
        return jsonify({"error": "Файл ZIP обязателен (поле file)"}), 400

    title = (request.form.get("title") or upload.filename or "Игра").strip()
    description = (request.form.get("description") or "").strip() or None
    zip_bytes = upload.read()
    if not zip_bytes:
        return jsonify({"error": "Пустой архив"}), 400

    game, error = BotGameService.create_from_zip(
        bot_id,
        str(current_user.id),
        title,
        description,
        zip_bytes,
    )
    if not game:
        return jsonify({"error": error or "Не удалось создать игру"}), 400

    payload = BotGameService.serialize(game)
    if error:
        payload["warning"] = error
    status = 201 if game.is_published else 202
    return jsonify({"game": payload}), status


@bot_games_bp.route("/<bot_id>/games/<game_id>", methods=["GET"])
@token_required
def get_bot_game(current_user, bot_id, game_id):
    game = BotGameService.get_game(bot_id, game_id)
    if not game:
        return jsonify({"error": "Игра не найдена"}), 404
    bot = BotGameService.get_bot(bot_id)
    can_manage = bot and BotGameService.can_manage_bot(
        bot, str(current_user.id), getattr(current_user, "role", None)
    )
    if not game.is_published and not can_manage:
        return jsonify({"error": "Игра недоступна"}), 403
    return jsonify({"game": BotGameService.serialize(game)}), 200


@bot_games_bp.route("/<bot_id>/games/<game_id>/embed", methods=["GET"])
def embed_bot_game(bot_id, game_id):
    game = BotGameService.get_game(bot_id, game_id)
    if not game or not game.is_published or game.scan_status != "approved":
        return "Игра недоступна", 404
    entry = BotGameService.resolve_asset_path(
        game, game.entry_path or "index.html")
    if not entry:
        return "index.html не найден", 404
    html = entry.read_text(encoding="utf-8", errors="replace")
    base_href = f"/api/v1/bots/{bot_id}/games/{game_id}/asset/"
    if "<head" in html.lower():
        html = html.replace(
            "<head>",
            f'<head><base href="{base_href}">',
            1,
        )
    else:
        html = f'<!DOCTYPE html><html><head><base href="{base_href}"></head><body>{html}</body></html>'
    return Response(
        html,
        mimetype="text/html",
        headers={
            "Content-Security-Policy": (
                "default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob:; "
                "img-src 'self' data: blob:; media-src 'self' data: blob:; "
                "connect-src 'none'; frame-src 'none';"),
        },
    )


@bot_games_bp.route("/<bot_id>/games/<game_id>/asset/<path:asset_path>",
                    methods=["GET"])
def game_asset(bot_id, game_id, asset_path):
    game = BotGameService.get_game(bot_id, game_id)
    if not game or not game.is_published or game.scan_status != "approved":
        return jsonify({"error": "Игра недоступна"}), 403
    target = BotGameService.resolve_asset_path(game, asset_path)
    if not target:
        return jsonify({"error": "Файл не найден"}), 404
    mime, _ = mimetypes.guess_type(str(target))
    return send_file(str(target), mimetype=mime or "application/octet-stream")


@bot_games_bp.route("/<bot_id>/games/<game_id>/download", methods=["GET"])
@token_required
def download_bot_game(current_user, bot_id, game_id):
    game = BotGameService.get_game(bot_id, game_id)
    if not game:
        return jsonify({"error": "Игра не найдена"}), 404
    if not game.is_published:
        bot = BotGameService.get_bot(bot_id)
        if not bot or not BotGameService.can_manage_bot(
            bot, str(current_user.id), getattr(current_user, "role", None)
        ):
            return jsonify({"error": "Игра недоступна"}), 403
    zip_path = BotGameService.make_download_zip(game)
    if not zip_path or not zip_path.is_file():
        return jsonify({"error": "Не удалось собрать архив"}), 500
    return send_file(
        str(zip_path),
        as_attachment=True,
        download_name=f"{game.title or 'game'}.zip",
        mimetype="application/zip",
    )
