import json
import logging
import aio_pika
from app.core.config import settings

logger = logging.getLogger(__name__)


async def publish_to_queue(queue_name: str, payload: dict) -> bool:
    """Публикует сообщение в очередь RabbitMQ асинхронно через aio-pika."""
    try:
        connection = await aio_pika.connect_robust(settings.RABBITMQ_URL, timeout=3.0)
        async with connection:
            channel = await connection.channel()
            await channel.declare_queue(queue_name, durable=True)

            message = aio_pika.Message(
                body=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
                delivery_mode=aio_pika.DeliveryMode.PERSISTENT,
                content_type="application/json",
            )
            await channel.default_exchange.publish(
                message,
                routing_key=queue_name,
            )
            logger.info(f"Successfully published task to RabbitMQ queue '{queue_name}' via aio-pika")
            return True
    except Exception as e:
        logger.warning(f"RabbitMQ publish to '{queue_name}' failed: {e}")
        return False
