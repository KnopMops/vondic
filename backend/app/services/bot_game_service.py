import json
import os
import shutil
import uuid
import zipfile
from pathlib import Path

import pika
from app.core.extensions import db
from app.models.bot import Bot
from app.models.bot_game import BotGame
from app.services.game_safety_scanner import scan_game_directory
from sqlalchemy import or_


def _uploads_root() -> Path:
    return Path(os.environ.get("UPLOADS_DIR", "/app/uploads"))


def _game_dir(bot_id: str, game_id: str) -> Path:
    return _uploads_root() / "bot_games" / bot_id / game_id


def _publish_game_scan(game_id: str, storage_dir: str) -> None:
    rabbit_url = os.environ.get(
        "RABBITMQ_URL", "amqp://guest:guest@rabbitmq:5672/%2F"
    )
    params = pika.URLParameters(rabbit_url)
    connection = pika.BlockingConnection(params)
    channel = connection.channel()
    channel.queue_declare(queue="game_scans", durable=True)
    payload = json.dumps(
        {"game_id": game_id, "storage_dir": storage_dir},
        ensure_ascii=False,
    )
    channel.basic_publish(
        exchange="",
        routing_key="game_scans",
        body=payload,
        properties=pika.BasicProperties(delivery_mode=2),
    )
    connection.close()


class BotGameService:
    @staticmethod
    def get_bot(bot_id: str) -> Bot | None:
        return Bot.query.filter_by(id=bot_id, is_active=1).first()

    @staticmethod
    def can_manage_bot(bot: Bot, user_id: str, user_role: str | None) -> bool:
        if user_role in ("Admin", "admin", "Support"):
            return True
        if bot.owner_id and str(bot.owner_id) == str(user_id):
            return True
        return False

    @staticmethod
    def list_games(bot_id: str, query: str | None = None, published_only: bool = True):
        q = BotGame.query.filter_by(bot_id=bot_id)
        if published_only:
            q = q.filter(BotGame.is_published == 1, BotGame.scan_status == "approved")
        if query:
            search = f"%{query.strip()}%"
            q = q.filter(
                or_(BotGame.title.ilike(search), BotGame.description.ilike(search))
            )
        return q.order_by(BotGame.created_at.desc()).all()

    @staticmethod
    def get_game(bot_id: str, game_id: str) -> BotGame | None:
        return BotGame.query.filter_by(id=game_id, bot_id=bot_id).first()

    @staticmethod
    def serialize(game: BotGame) -> dict:
        return {
            "id": game.id,
            "bot_id": game.bot_id,
            "title": game.title,
            "description": game.description,
            "entry_path": game.entry_path,
            "scan_status": game.scan_status,
            "scan_error": game.scan_error,
            "is_published": bool(game.is_published),
            "created_at": game.created_at.isoformat() if game.created_at else None,
            "updated_at": game.updated_at.isoformat() if game.updated_at else None,
            "play_url": f"/feed/bot-game/{game.bot_id}/{game.id}",
            "download_url": f"/api/v1/bots/{game.bot_id}/games/{game.id}/download",
        }

    @staticmethod
    def create_from_zip(
        bot_id: str,
        user_id: str,
        title: str,
        description: str | None,
        zip_bytes: bytes,
    ) -> tuple[BotGame | None, str | None]:
        bot = BotGameService.get_bot(bot_id)
        if not bot:
            return None, "Бот не найден"

        if len(zip_bytes) > 30 * 1024 * 1024:
            return None, "Архив слишком большой (макс. 30 МБ)"

        game_id = str(uuid.uuid4())
        dest = _game_dir(bot_id, game_id)
        dest.mkdir(parents=True, exist_ok=True)

        zip_path = dest / "_upload.zip"
        zip_path.write_bytes(zip_bytes)

        try:
            with zipfile.ZipFile(zip_path, "r") as zf:
                for info in zf.infolist():
                    if info.is_dir():
                        continue
                    name = info.filename.replace("\\", "/").lstrip("/")
                    if ".." in name.split("/"):
                        raise ValueError("Недопустимый путь в ZIP")
                    target = dest / name
                    target.parent.mkdir(parents=True, exist_ok=True)
                    with zf.open(info) as src, open(target, "wb") as out:
                        shutil.copyfileobj(src, out)
        except zipfile.BadZipFile:
            shutil.rmtree(dest, ignore_errors=True)
            return None, "Некорректный ZIP-архив"
        except Exception as e:
            shutil.rmtree(dest, ignore_errors=True)
            return None, str(e)
        finally:
            if zip_path.exists():
                zip_path.unlink()

        ok, err, meta = scan_game_directory(str(dest))
        entry = meta.get("entry", "index.html") if meta else "index.html"

        game = BotGame(
            id=game_id,
            bot_id=bot_id,
            created_by=str(user_id),
            title=title.strip() or "Игра",
            description=(description or "").strip() or None,
            entry_path=entry,
            storage_dir=str(dest),
            scan_status="approved" if ok else "rejected",
            scan_error=err,
            scan_result=json.dumps(meta, ensure_ascii=False) if meta else None,
            is_published=1 if ok else 0,
        )
        db.session.add(game)
        db.session.commit()

        if not ok:
            return game, err

        try:
            _publish_game_scan(game.id, game.storage_dir)
        except Exception:
            pass

        return game, None

    @staticmethod
    def apply_scan_result(game_id: str, ok: bool, error: str | None, meta: dict) -> None:
        game = BotGame.query.get(game_id)
        if not game:
            return
        game.scan_status = "approved" if ok else "rejected"
        game.scan_error = error
        game.scan_result = json.dumps(meta, ensure_ascii=False) if meta else None
        game.is_published = 1 if ok else 0
        if ok and meta.get("entry"):
            game.entry_path = meta["entry"]
        db.session.commit()

    @staticmethod
    def resolve_asset_path(game: BotGame, rel_path: str) -> Path | None:
        base = Path(game.storage_dir).resolve()
        target = (base / rel_path).resolve()
        if not str(target).startswith(str(base)):
            return None
        if not target.is_file():
            return None
        return target

    @staticmethod
    def make_download_zip(game: BotGame) -> Path | None:
        base = Path(game.storage_dir)
        if not base.is_dir():
            return None
        out = base / "_download.zip"
        if out.exists():
            out.unlink()
        shutil.make_archive(str(out.with_suffix("")), "zip", base)
        return out.with_suffix(".zip")
