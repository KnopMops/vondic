"""
Core extensions module replacing Flask extensions with FastAPI / SQLAlchemy / Redis equivalents.
"""
import logging
from functools import wraps
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

    def memoize(self, timeout: Optional[int] = None, make_name: Optional[Any] = None, unless: Optional[Any] = None):
        def decorator(f):
            @wraps(f)
            def wrapper(*args, **kwargs):
                return f(*args, **kwargs)
            return wrapper
        return decorator

    def cached(self, timeout: Optional[int] = None, key_prefix: Optional[str] = None, unless: Optional[Any] = None):
        def decorator(f):
            @wraps(f)
            def wrapper(*args, **kwargs):
                return f(*args, **kwargs)
            return wrapper
        return decorator

    def delete_memoized(self, f, *args, **kwargs):
        pass


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
