"""
Core extensions module replacing Flask extensions with FastAPI / SQLAlchemy / Redis equivalents.
"""
import logging
from typing import Any, Optional
from app.core.database import Base

logger = logging.getLogger(__name__)


class DummyCache:
    def __init__(self):
        self._memory_store = {}

    def get(self, key: str) -> Optional[Any]:
        return self._memory_store.get(key)

    def set(self, key: str, value: Any, timeout: Optional[int] = None) -> None:
        self._memory_store[key] = value

    def delete(self, key: str) -> None:
        self._memory_store.pop(key, None)


class DummyDB:
    Model = Base
    Column = None
    relationship = None


db = DummyDB()
cache = DummyCache()
mail = None
migrate = None
ma = None
cors = None
