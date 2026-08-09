"""
Воркер RabbitMQ для обработки очередей отправки Email и Push-уведомлений (email_queue и push_queue).
"""

import json
import logging
import os
import sys
import time
import pika

# Добавляем директорию бэкенда в PYTHONPATH для работы с Flask app context
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from app import create_app
from app.core.extensions import db, mail
from flask_mail import Message

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("notification_worker")

RABBITMQ_URL = os.environ.get("RABBITMQ_URL", "amqp://guest:guest@rabbitmq:5672/%2F")
app = create_app()


def process_email_message(ch, method, properties, body):
    try:
        data = json.loads(body.decode("utf-8"))
        to_email = data.get("to_email")
        subject = data.get("subject", "Уведомление Vondic")
        html = data.get("html", "")

        if not to_email or not html:
            logger.warning(f"Invalid email task payload: {data}")
            ch.basic_ack(delivery_tag=method.delivery_tag)
            return

        with app.app_context():
            msg = Message(subject=subject, recipients=[to_email], html=html)
            mail.send(msg)
            logger.info(f"Email '{subject}' successfully sent to {to_email}")

        ch.basic_ack(delivery_tag=method.delivery_tag)
    except Exception as e:
        logger.error(f"Error processing email task: {e}", exc_info=True)
        # Nack and requeue on temporary failure
        ch.basic_nack(delivery_tag=method.delivery_tag, requeue=False)


def process_push_message(ch, method, properties, body):
    try:
        payload = json.loads(body.decode("utf-8"))
        user_id = payload.get("user_id")
        title = payload.get("title", "Вондик")
        push_body = payload.get("body", "У вас новое сообщение")
        data = payload.get("data", {})

        if not user_id:
            logger.warning(f"Invalid push task payload: {payload}")
            ch.basic_ack(delivery_tag=method.delivery_tag)
            return

        with app.app_context():
            # Query push subscriptions for user
            from sqlalchemy import text
            res = db.session.execute(
                text("SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = :uid"),
                {"uid": str(user_id)}
            )
            rows = res.fetchall()

            if rows:
                vapid_private = os.environ.get("VAPID_PRIVATE_KEY") or "ZgiAe9mf4fmMp_Suy_ZQjj0CZVys5zRsFex25DllvTo"
                vapid_public = os.environ.get("VAPID_PUBLIC_KEY") or "BIe-Z2GMAZp05xBkGysdmolFc7jczvXIQJcGDVfkWkyY-P1XJnJoTcyOzW00-z6AvlleA7wxFXa8B-f_RHI5pBk"
                vapid_claims = {"sub": "mailto:admin@vondic.ru"}

                try:
                    from pywebpush import webpush
                    for row in rows:
                        endpoint, p256dh, auth_key = row[0], row[1], row[2]
                        try:
                            resp = webpush(
                                subscription_info={
                                    "endpoint": endpoint,
                                    "keys": {"p256dh": p256dh, "auth": auth_key}
                                },
                                data=json.dumps({"title": title, "body": push_body, "data": data}),
                                vapid_private_key=vapid_private,
                                vapid_claims=vapid_claims,
                                headers={"Urgency": "high", "TTL": "86400"},
                                timeout=10
                            )
                            status = resp.status_code if hasattr(resp, "status_code") else 201
                            logger.info(f"Web Push (RabbitMQ worker) dispatched to {endpoint[:45]} -> status={status}")
                        except Exception as wpe:
                            logger.warning(f"Web Push error for {endpoint[:45]}: {wpe}")
                except Exception as pe:
                    logger.error(f"pywebpush import/execution error: {pe}")

        ch.basic_ack(delivery_tag=method.delivery_tag)
    except Exception as e:
        logger.error(f"Error processing push task: {e}", exc_info=True)
        ch.basic_nack(delivery_tag=method.delivery_tag, requeue=False)


def start_worker():
    logger.info("Starting RabbitMQ Notification Worker (email_queue & push_queue)...")
    while True:
        try:
            parameters = pika.URLParameters(RABBITMQ_URL)
            parameters.heartbeat = 60
            connection = pika.BlockingConnection(parameters)
            channel = connection.channel()

            channel.queue_declare(queue="email_queue", durable=True)
            channel.queue_declare(queue="push_queue", durable=True)

            channel.basic_qos(prefetch_count=10)

            channel.basic_consume(queue="email_queue", on_message_callback=process_email_message)
            channel.basic_consume(queue="push_queue", on_message_callback=process_push_message)

            logger.info("RabbitMQ Notification Worker connected and listening on 'email_queue' and 'push_queue'.")
            channel.start_consuming()
        except KeyboardInterrupt:
            logger.info("Worker stopped by user.")
            break
        except Exception as e:
            logger.warning(f"RabbitMQ connection lost ({e}). Retrying in 5 seconds...")
            time.sleep(5)


if __name__ == "__main__":
    start_worker()
