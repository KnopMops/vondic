from app.core.extensions import db
from app.exceptions import AppError


def db_commit():
    try:
        db.session.commit()
    except Exception as exc:
        db.session.rollback()
        raise AppError("Не удалось сохранить данные", status_code=500) from exc
