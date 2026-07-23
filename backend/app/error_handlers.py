import time
import logging
from flask import jsonify
from sqlalchemy.exc import OperationalError, DBAPIError, SQLAlchemyError
from werkzeug.exceptions import HTTPException

from app.core.extensions import db
from app.exceptions import AppError

logger = logging.getLogger(__name__)

MAX_RETRIES = 2
RETRY_DELAY = 0.1


def register_error_handlers(app):
    @app.errorhandler(AppError)
    def handle_app_error(exc: AppError):
        body = {"error": exc.message}
        if exc.code:
            body["code"] = exc.code
        return jsonify(body), exc.status_code

    @app.errorhandler(SQLAlchemyError)
    def handle_database_error(exc: SQLAlchemyError):
        if not isinstance(exc, (OperationalError, DBAPIError)):
            db.session.rollback()
            app.logger.exception("Database error: %s", exc)
            return jsonify({"error": "Ошибка базы данных"}), 500

        # Transient connection error — try retry with fresh connection
        for attempt in range(MAX_RETRIES):
            try:
                db.session.rollback()
                db.session.remove()
                # Force a new connection
                with db.engine.connect() as conn:
                    conn.execute(db.text("SELECT 1"))
                db.session.commit()
                app.logger.info("DB connection recovered after retry %d", attempt + 1)
                return jsonify({"error": "Ошибка базы данных, попробуйте снова"}), 503
            except Exception:
                time.sleep(RETRY_DELAY)

        app.logger.exception("Database error after %d retries: %s", MAX_RETRIES, exc)
        db.session.rollback()
        db.session.remove()
        return jsonify({"error": "Ошибка базы данных"}), 500

    @app.errorhandler(HTTPException)
    def handle_http_exception(exc: HTTPException):
        message = exc.description or exc.name
        return jsonify({"error": message}), exc.code or 500

    @app.errorhandler(Exception)
    def handle_unexpected_error(exc: Exception):
        db.session.rollback()
        app.logger.exception("Unhandled error: %s", exc)
        if app.debug or app.config.get("TESTING"):
            return jsonify(
                {"error": "Внутренняя ошибка сервера", "detail": str(exc)}), 500
        return jsonify({"error": "Внутренняя ошибка сервера"}), 500
