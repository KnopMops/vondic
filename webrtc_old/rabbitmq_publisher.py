import json
import logging
import os
import pika

logger = logging.getLogger(__name__)

RABBITMQ_URL = os.environ.get("RABBITMQ_URL", "amqp://guest:guest@rabbitmq:5672/%2F")


def publish_to_queue(queue_name: str, payload: dict) -> bool:
    """Публикует Push-уведомление в RabbitMQ очередь 'push_queue'."""
    connection = None
    try:
        parameters = pika.URLParameters(RABBITMQ_URL)
        parameters.socket_timeout = 3
        connection = pika.BlockingConnection(parameters)
        channel = connection.channel()
        channel.queue_declare(queue=queue_name, durable=True)
        channel.basic_publish(
            exchange="",
            routing_key=queue_name,
            body=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
            properties=pika.BasicProperties(
                delivery_mode=2,
                content_type="application/json",
            ),
        )
        logger.info(f"Published push task to RabbitMQ queue '{queue_name}' for user {payload.get('user_id')}")
        return True
    except Exception as e:
        logger.warning(f"RabbitMQ publish to '{queue_name}' failed: {e}")
        return False
    finally:
        if connection and not connection.is_closed:
            try:
                connection.close()
            except Exception:
                pass
