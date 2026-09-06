import json
import logging
import pika

logger = logging.getLogger(__name__)

RABBITMQ_URL = "amqp://guest:guest@rabbitmq:5672/%2F"


def publish_to_queue(queue_name: str, payload: dict) -> bool:
    """Публикует сообщение в очередь RabbitMQ синхронно через pika."""
    try:
        params = pika.URLParameters(RABBITMQ_URL)
        connection = pika.BlockingConnection(params)
        channel = connection.channel()
        channel.queue_declare(queue=queue_name, durable=True)

        channel.basic_publish(
            exchange="",
            routing_key=queue_name,
            body=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
            properties=pika.BasicProperties(
                delivery_mode=2,  # persistent
                content_type="application/json",
            ),
        )
        connection.close()
        logger.info(f"Published to RabbitMQ queue '{queue_name}'")
        return True
    except Exception as e:
        logger.warning(f"RabbitMQ publish to '{queue_name}' failed: {e}")
        return False
