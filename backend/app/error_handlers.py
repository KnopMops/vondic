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
        try:
            db.session.rollback()
        except Exception:
            pass
        try:
            db.session.remove()
        except Exception:
            pass
        app.logger.exception("Database error: %s", exc)
        return jsonify({"error": "Ошибка базы данных"}), 500

    @app.errorhandler(HTTPException)
    def handle_http_exception(exc: HTTPException):
        message = exc.description or exc.name
        return jsonify({"error": message}), exc.code or 500

    @app.errorhandler(Exception)
    def handle_unexpected_error(exc: Exception):
        db.session.rollback()
        app.logger.exception("Unhandled error: %s", exc)
        return jsonify({"error": "Внутренняя ошибка сервера"}), 500
