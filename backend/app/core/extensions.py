"""
Core extensions module replacing Flask extensions with FastAPI / SQLAlchemy / Redis equivalents.
"""
import json
import logging
import os
from functools import wraps
from typing import Any, Optional

from app.core.database import Base, SyncScopedSession

logger = logging.getLogger(__name__)


class AppCache:
    """Multi-worker Redis-backed cache with in-memory fallback."""

    def __init__(self):
        self._memory_store = {}
        self._redis = None
        self._redis_checked = False

    def _get_redis(self):
        if not self._redis_checked:
            self._redis_checked = True
            try:
                import redis
                from app.core.config import Config
                redis_url = Config.CACHE_REDIS_URL or os.environ.get("REDIS_URL")
                if redis_url:
                    self._redis = redis.Redis.from_url(redis_url, decode_responses=True)
                    self._redis.ping()
                else:
                    host = os.environ.get("REDIS_HOST", "redis")
                    port = int(os.environ.get("REDIS_PORT", 6379))
                    password = os.environ.get("REDIS_PASSWORD") or None
                    self._redis = redis.Redis(host=host, port=port, password=password, decode_responses=True)
                    self._redis.ping()
                logger.info("[AppCache] Connected to shared Redis cache successfully")
            except Exception as e:
                logger.warning(f"[AppCache] Redis unavailable ({e}), using in-memory cache")
                self._redis = None
        return self._redis

    def get(self, key: str) -> Optional[Any]:
        r = self._get_redis()
        if r:
            try:
                val = r.get(key)
                if val is not None:
                    try:
                        return json.loads(val)
                    except Exception:
                        return val
            except Exception as e:
                logger.error(f"[AppCache] Redis get error for {key}: {e}")
        return self._memory_store.get(key)

    def set(self, key: str, value: Any, timeout: Optional[int] = None) -> None:
        self._memory_store[key] = value
        r = self._get_redis()
        if r:
            try:
                if isinstance(value, (dict, list, bool, int, float)):
                    val = json.dumps(value)
                else:
                    val = str(value)
                if timeout:
                    r.setex(key, int(timeout), val)
                else:
                    r.set(key, val)
            except Exception as e:
                logger.error(f"[AppCache] Redis set error for {key}: {e}")

    def delete(self, key: str) -> None:
        self._memory_store.pop(key, None)
        r = self._get_redis()
        if r:
            try:
                r.delete(key)
            except Exception as e:
                logger.error(f"[AppCache] Redis delete error for {key}: {e}")

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

    @property
    def session(self):
        return SyncScopedSession

    @property
    def func(self):
        from sqlalchemy import func
        return func


db = DummyDB()
cache = AppCache()
mail = None
migrate = None
ma = None
cors = None
