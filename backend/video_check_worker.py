import json
import os
import subprocess
import sys
import threading
import time

import pika
from app import create_app
from app.core.extensions import db
from sqlalchemy import text


def ensure_checks_table():
    try:
        if db.engine.dialect.name == "sqlite":
            db.session.execute(
                text("""
                CREATE TABLE IF NOT EXISTS video_checks (
                    id TEXT PRIMARY KEY,
                    video_url TEXT,
                    file_path TEXT,
                    status TEXT,
                    result_json TEXT,
                    error TEXT,
                    created_at TEXT,
                    updated_at TEXT
                )
            """)
            )
            db.session.execute(
                text(
                    "CREATE INDEX IF NOT EXISTS idx_video_checks_status ON video_checks(status)"
                )
            )
            db.session.commit()
        else:
            db.session.execute(
                text("""
                CREATE TABLE IF NOT EXISTS video_checks (
                    id TEXT PRIMARY KEY,
                    video_url TEXT,
                    file_path TEXT,
                    status TEXT,
                    result_json TEXT,
                    error TEXT,
                    created_at TEXT,
                    updated_at TEXT
                )
            """)
            )
            db.session.execute(
                text(
                    "CREATE INDEX IF NOT EXISTS idx_video_checks_status ON video_checks(status)"
                )
            )
            db.session.commit()
    except Exception:
        pass


def _clean_text(value: str | None):
    if value is None:
        return None
    if "\x00" in value:
        return value.replace("\x00", "")
    return value


def _trim_text(value: str | None, limit: int = 800):
    if value is None:
        return None
    if len(value) <= limit:
        return value
    return value[:limit]


def update_job(
    job_id: str, status: str, result_json: str | None = None, error: str | None = None
):
    ts = time.strftime("%Y-%m-%dT%H:%M:%S")
    db.session.execute(
        text("""
        UPDATE video_checks
        SET status = :status, result_json = :result_json, error = :error, updated_at = :ts
        WHERE id = :id
    """),
        {
            "status": status,
            "result_json": _clean_text(result_json),
            "error": _clean_text(error),
            "ts": ts,
            "id": job_id,
        },
    )
    db.session.commit()


def run_checker(file_path: str):
    script_path = os.path.abspath(
        os.path.join(os.path.dirname(__file__), "..",
                     "video_checker", "main.py")
    )
    if not os.path.isfile(script_path):
        return None, "Checker not found"
    env = os.environ.copy()
    env.setdefault("ORT_LOGGING_LEVEL", "4")
    env.setdefault("ORT_LOG_SEVERITY_LEVEL", "4")
    result = subprocess.run(
        [sys.executable, script_path, file_path],
        capture_output=True,
        text=True,
        check=False,
        env=env,
    )
    raw_stdout = (result.stdout or "").strip()
    raw_stderr = (result.stderr or "").strip()
    if result.returncode != 0:
        lines = [line.strip()
                 for line in raw_stdout.splitlines() if line.strip()]
        if lines:
            try:
                payload = json.loads(lines[-1])
                return payload, None
            except Exception:
                pass
        stderr_lines = [
            line.strip() for line in raw_stderr.splitlines() if line.strip()
        ]
        filtered = [
            line for line in stderr_lines if "onnxruntime" not in line.lower()]
        err = ("\n".join(filtered) or raw_stdout or "Checker failed").strip()
        return None, _trim_text(err)
    raw = raw_stdout
    if not raw:
        return None, raw_stderr or "Checker returned пустой ответ"
    lines = [line.strip() for line in raw.splitlines() if line.strip()]
    if not lines:
        return None, "Checker вернул некорректный JSON"
    try:
        payload = json.loads(lines[-1])
        return payload, None
    except Exception:
        return None, "Checker вернул некорректный JSON"


def _purge_queue(ch):
    try:
        ch.queue_purge(queue="video_checks")
    except Exception:
        pass


def handle_message(ch, method, properties, body, app):
    try:
        payload = json.loads(body or "{}")
    except Exception:
        ch.basic_ack(delivery_tag=method.delivery_tag)
        return
    job_id = payload.get("job_id")
    file_path = payload.get("file_path")
    if not job_id:
        ch.basic_ack(delivery_tag=method.delivery_tag)
        return
    with app.app_context():
        try:
            ensure_checks_table()
            update_job(job_id, "processing")
            if not file_path or not os.path.isfile(file_path):
                update_job(job_id, "error", None, "Video file not found")
                _purge_queue(ch)
                ch.basic_ack(delivery_tag=method.delivery_tag)
                return
            result, error = run_checker(file_path)
            if error:
                update_job(job_id, "error", None, error)
                _purge_queue(ch)
            else:
                update_job(job_id, "done", json.dumps(
                    result, ensure_ascii=False), None)
        except Exception as e:
            update_job(job_id, "error", None, str(e))
            _purge_queue(ch)
    ch.basic_ack(delivery_tag=method.delivery_tag)


def _consume(app):
    rabbit_url = os.environ.get(
        "RABBITMQ_URL", "amqp://guest:guest@localhost:5672/%2F")
    params = pika.URLParameters(rabbit_url)
    connection = pika.BlockingConnection(params)
    channel = connection.channel()
    channel.queue_declare(queue="video_checks", durable=True)
    channel.basic_qos(prefetch_count=1)
    channel.basic_consume(
        queue="video_checks",
        on_message_callback=lambda ch, method, properties, body: handle_message(
            ch, method, properties, body, app
        ),
    )
    channel.start_consuming()


def main():
    app = create_app()
    worker_count = int(os.environ.get("RABBITMQ_WORKERS", "2"))
    worker_count = max(1, worker_count)
    threads = []
    for _ in range(worker_count):
        t = threading.Thread(target=_consume, args=(app,), daemon=True)
        t.start()
        threads.append(t)
    for t in threads:
        t.join()


if __name__ == "__main__":
    main()
