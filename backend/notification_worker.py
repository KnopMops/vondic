"""
Воркер RabbitMQ для обработки очередей отправки Email и Push-уведомлений (email_queue и push_queue).
"""

import json
import logging
import os
import smtplib
import sys
import time
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
import pika

sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from app.core.config import settings

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("notification_worker")

RABBITMQ_URL = os.environ.get("RABBITMQ_URL", "amqp://guest:guest@rabbitmq:5672/%2F")


def send_smtp_email(to_email: str, subject: str, html_content: str):
    smtp_host = getattr(settings, "MAIL_SERVER", None) or os.environ.get("MAIL_SERVER", "localhost")
    smtp_port = int(getattr(settings, "MAIL_PORT", 587) or os.environ.get("MAIL_PORT", 587))
    sender = getattr(settings, "MAIL_DEFAULT_SENDER", None) or os.environ.get("MAIL_DEFAULT_SENDER", "noreply@vondic.ru")
    username = getattr(settings, "MAIL_USERNAME", None) or os.environ.get("MAIL_USERNAME")
    password = getattr(settings, "MAIL_PASSWORD", None) or os.environ.get("MAIL_PASSWORD")

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = sender
    msg["To"] = to_email
    msg.attach(MIMEText(html_content, "html", "utf-8"))

    try:
        server = smtplib.SMTP(smtp_host, smtp_port, timeout=15)
        if getattr(settings, "MAIL_USE_TLS", True):
            server.starttls()
        if username and password:
            server.login(username, password)
        server.sendmail(sender, [to_email], msg.as_string())
        server.quit()
        logger.info(f"Email sent successfully to {to_email}")
        return True
    except Exception as e:
        logger.error(f"Failed to send email to {to_email}: {e}")
        return False


def process_email_message(ch, method, properties, body):
    try:
        payload = json.loads(body)
        to_email = payload.get("to_email")
        subject = payload.get("subject", "Vondic Notification")
        html = payload.get("html", "")

        if not to_email:
            logger.warning("Empty to_email in email message payload")
            ch.basic_ack(delivery_tag=method.delivery_tag)
            return

        success = send_smtp_email(to_email, subject, html)
        if success:
            ch.basic_ack(delivery_tag=method.delivery_tag)
        else:
            ch.basic_nack(delivery_tag=method.delivery_tag, requeue=True)
    except Exception as e:
        logger.error(f"Error processing email message: {e}")
        ch.basic_ack(delivery_tag=method.delivery_tag)


def process_push_message(ch, method, properties, body):
    try:
        payload = json.loads(body)
        user_id = payload.get("user_id")
        title = payload.get("title")
        message = payload.get("message")
        logger.info(f"Push notification queued for user {user_id}: {title} - {message}")
        ch.basic_ack(delivery_tag=method.delivery_tag)
    except Exception as e:
        logger.error(f"Error processing push message: {e}")
        ch.basic_ack(delivery_tag=method.delivery_tag)


def start_worker():
    parameters = pika.URLParameters(RABBITMQ_URL)
    connection = None
    retry_delay = 5
    max_retries = 10

    for attempt in range(max_retries):
        try:
            connection = pika.BlockingConnection(parameters)
            logger.info("Connected to RabbitMQ")
            break
        except Exception as e:
            logger.warning(f"Connection to RabbitMQ failed ({attempt + 1}/{max_retries}): {e}")
            time.sleep(retry_delay)

    if not connection:
        logger.error("Could not connect to RabbitMQ after retries. Exiting.")
        sys.exit(1)

    channel = connection.channel()
    channel.queue_declare(queue="email_queue", durable=True)
    channel.queue_declare(queue="push_queue", durable=True)

    channel.basic_qos(prefetch_count=1)
    channel.basic_consume(queue="email_queue", on_message_callback=process_email_message)
    channel.basic_consume(queue="push_queue", on_message_callback=process_push_message)

    logger.info("Notification worker started listening on email_queue and push_queue...")
    try:
        channel.start_consuming()
    except KeyboardInterrupt:
        channel.stop_consuming()
        connection.close()


if __name__ == "__main__":
    start_worker()
