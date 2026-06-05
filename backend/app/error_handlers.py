from flask import jsonify
from sqlalchemy.exc import SQLAlchemyError
from werkzeug.exceptions import HTTPException

from app.core.extensions import db
from app.exceptions import AppError


def register_error_handlers(app):
    @app.errorhandler(AppError)
    def handle_app_error(exc: AppError):
        body = {"error": exc.message}
        if exc.code:
            body["code"] = exc.code
        return jsonify(body), exc.status_code

    @app.errorhandler(SQLAlchemyError)
    def handle_database_error(exc: SQLAlchemyError):
        db.session.rollback()
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
        if app.debug or app.config.get("TESTING"):
            return jsonify(
                {"error": "Внутренняя ошибка сервера", "detail": str(exc)}), 500
        return jsonify({"error": "Внутренняя ошибка сервера"}), 500
