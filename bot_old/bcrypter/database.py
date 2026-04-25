import logging
import os
import secrets
from contextlib import contextmanager
from datetime import datetime

from sqlalchemy import DateTime, Integer, Text, create_engine
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Mapped, Session, declarative_base, mapped_column, sessionmaker

logger = logging.getLogger(__name__)
Base = declarative_base()


def _build_postgres_dsn() -> str:
    explicit = os.environ.get("POSTGRES_URL") or os.environ.get("DATABASE_URL")
    if explicit:
        return explicit.replace("postgresql+psycopg2://", "postgresql://")
    host = os.environ.get("POSTGRES_HOST")
    if not host:
        raise RuntimeError(
            "PostgreSQL не настроен для bot. Установите POSTGRES_* или DATABASE_URL."
        )
    user = os.environ.get("POSTGRES_USER", "postgres")
    password = os.environ.get("POSTGRES_PASSWORD", "")
    port = os.environ.get("POSTGRES_PORT", "5432")
    db = os.environ.get("POSTGRES_DB", "postgres")
    auth = f"{user}@"
    if password:
        auth = f"{user}:{password}@"
    return f"postgresql://{auth}{host}:{port}/{db}"


class UserModel(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    username: Mapped[str] = mapped_column(Text, nullable=False)
    email: Mapped[str] = mapped_column(Text, nullable=False)
    password_hash: Mapped[str] = mapped_column(Text, nullable=False)
    access_token: Mapped[str | None] = mapped_column(Text, nullable=True)
    refresh_token: Mapped[str | None] = mapped_column(Text, nullable=True)
    avatar_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    premium: Mapped[int | None] = mapped_column(Integer, nullable=True)
    updated_at: Mapped[datetime | None] = mapped_column(
        DateTime, nullable=True)


class AuthRepository:
    def __init__(self, db_path=None):
        self.db_path = db_path or _build_postgres_dsn()
        self.engine = create_engine(self.db_path, pool_pre_ping=True)
        self.session_factory = sessionmaker(
            bind=self.engine, expire_on_commit=False)
        self._init_db()

    @contextmanager
    def _session(self):
        session: Session = self.session_factory()
        try:
            yield session
            session.commit()
        except Exception:
            session.rollback()
            raise
        finally:
            session.close()

    @staticmethod
    def _to_dict(model):
        return {column.name: getattr(model, column.name)
                for column in model.__table__.columns}

    def _init_db(self):
        try:
            Base.metadata.create_all(
                self.engine, tables=[
                    UserModel.__table__], checkfirst=True)
        except Exception as exc:
            logger.warning("AuthRepository init schema skipped: %s", exc)

    def user_exists(self, user_id: str) -> bool:
        with self._session() as session:
            return session.query(
                UserModel.id).filter(
                UserModel.id == str(user_id)).first() is not None

    def save_user_key(
        self,
        user_id: str,
        username: str,
        password_hash: str,
        avatar_url: str = None,
    ) -> bool:
        email = f"{user_id}@telegram.bot"
        access_token = secrets.token_hex(32)
        refresh_token = secrets.token_hex(32)
        try:
            with self._session() as session:
                user = UserModel(
                    id=str(user_id),
                    username=username,
                    email=email,
                    password_hash=password_hash,
                    access_token=access_token,
                    refresh_token=refresh_token,
                    avatar_url=avatar_url,
                    updated_at=datetime.utcnow(),
                )
                session.add(user)
            return True
        except IntegrityError:
            return False
        except SQLAlchemyError:
            return False

    def update_user_key(
            self,
            user_id: str,
            password_hash: str,
            avatar_url: str = None) -> bool:
        try:
            with self._session() as session:
                user = session.query(UserModel).filter(
                    UserModel.id == str(user_id)).first()
                if not user:
                    return False
                user.password_hash = password_hash
                user.updated_at = datetime.utcnow()
                if avatar_url is not None:
                    user.avatar_url = avatar_url
            return True
        except SQLAlchemyError:
            return False

    def get_password_hash(self, user_id: str) -> str:
        with self._session() as session:
            row = session.query(UserModel).filter(
                UserModel.id == str(user_id)).first()
            return row.password_hash if row else None

    def get_user_by_email(self, email: str):
        with self._session() as session:
            row = session.query(UserModel).filter(
                UserModel.email == email).first()
            return self._to_dict(row) if row else None

    def set_premium(self, user_id: str, premium_status: int) -> bool:
        try:
            with self._session() as session:
                user = session.query(UserModel).filter(
                    UserModel.id == str(user_id)).first()
                if not user:
                    return False
                user.premium = int(premium_status)
                user.updated_at = datetime.utcnow()
            return True
        except SQLAlchemyError:
            return False
