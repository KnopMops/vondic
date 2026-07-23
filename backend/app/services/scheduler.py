"""Background scheduler: sends pending scheduled messages + cleans up disappearing messages."""
import logging
import threading
import time
from datetime import datetime

logger = logging.getLogger(__name__)

_send_fn = None
_app = None


def init_scheduler(send_fn, app):
    global _send_fn, _app
    _send_fn = send_fn
    _app = app
    t = threading.Thread(target=_run, daemon=True)
    t.start()
    logger.info("Scheduler started")


def _run():
    while True:
        try:
            with _app.app_context():
                _check_and_send()
                _cleanup_disappearing()
        except Exception as e:
            logger.error(f"Scheduler error: {e}")
        time.sleep(30)


def _check_and_send():
    from app.models.scheduled_message import ScheduledMessage
    from app.core.extensions import db as _db
    now = datetime.utcnow()
    pending = (
        _db.session.query(ScheduledMessage)
        .filter(ScheduledMessage.sent_at.is_(None))
        .filter(ScheduledMessage.scheduled_at <= now)
        .all()
    )
    for msg in pending:
        try:
            _send_fn(msg)
            msg.sent_at = now
            _db.session.commit()
            logger.info(f"Sent scheduled {msg.id}")
        except Exception as e:
            logger.error(f"Failed scheduled {msg.id}: {e}")
            _db.session.rollback()


def _cleanup_disappearing():
    """Mark messages as deleted when disappear_at has passed."""
    from app.models.message import Message
    from app.core.extensions import db as _db
    now = datetime.utcnow()
    expired = (
        _db.session.query(Message)
        .filter(Message.disappear_at.isnot(None))
        .filter(Message.disappear_at <= now)
        .filter(Message.is_deleted == False)
        .all()
    )
    for msg in expired:
        try:
            msg.is_deleted = True
            msg.content = ""
            _db.session.commit()
        except Exception:
            _db.session.rollback()
