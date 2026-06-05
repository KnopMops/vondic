"""Воркер проверки игр ботов через RabbitMQ (очередь game_scans)."""

import json
import os
import time

import pika
from app import create_app
from app.core.extensions import db
from app.models.bot_game import BotGame
from app.services.game_safety_scanner import scan_game_directory


def process_message(game_id: str, storage_dir: str) -> None:
    from app.services.bot_game_service import BotGameService

    ok, err, meta = scan_game_directory(storage_dir)
    BotGameService.apply_scan_result(game_id, ok, err, meta)


def main():
    rabbit_url = os.environ.get(
        "RABBITMQ_URL", "amqp://guest:guest@rabbitmq:5672/%2F"
    )
    app = create_app()
    with app.app_context():
        db.create_all()
        while True:
            try:
                params = pika.URLParameters(rabbit_url)
                connection = pika.BlockingConnection(params)
                channel = connection.channel()
                channel.queue_declare(queue="game_scans", durable=True)
                channel.basic_qos(prefetch_count=2)

                def callback(ch, method, properties, body):
                    try:
                        payload = json.loads(body.decode("utf-8"))
                        game_id = payload.get("game_id")
                        storage_dir = payload.get("storage_dir")
                        if game_id and storage_dir:
                            process_message(game_id, storage_dir)
                    except Exception as exc:
                        print(f"[game_scan_worker] error: {exc}")
                    ch.basic_ack(delivery_tag=method.delivery_tag)

                channel.basic_consume(
                    queue="game_scans", on_message_callback=callback
                )
                print("[game_scan_worker] waiting for jobs...")
                channel.start_consuming()
            except Exception as exc:
                print(f"[game_scan_worker] reconnect in 5s: {exc}")
                time.sleep(5)


if __name__ == "__main__":
    main()
