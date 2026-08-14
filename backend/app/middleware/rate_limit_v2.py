"""V2 API rate limit headers middleware."""
import time
import logging
from functools import wraps
from collections import defaultdict, deque
from threading import Lock


logger = logging.getLogger(__name__)


class SlidingWindowRateLimiter:
    """Redis-backed sliding window rate limiter with response headers."""

    def __init__(self, redis_client=None):
        self.redis = redis_client
        self._in_memory = defaultdict(deque)
        self._lock = Lock()

    def check(self, key, limit, window_seconds):
        """Check rate limit. Returns (allowed, remaining, reset_time)."""
        now = time.time()
        reset_time = int(now + window_seconds)

        if self.redis:
            return self._check_redis(key, limit, window_seconds, now, reset_time)
        return self._check_memory(key, limit, window_seconds, now, reset_time)

    def _check_redis(self, key, limit, window_seconds, now, reset_time):
        pipe = self.redis.pipeline()
        window_start = now - window_seconds
        pipe.zremrangebyscore(key, 0, window_start)
        pipe.zadd(key, {str(now): now})
        pipe.zcard(key)
        pipe.expire(key, window_seconds)
        results = pipe.execute()
        count = results[2]
        remaining = max(0, limit - count)
        return count <= limit, remaining, reset_time

    def _check_memory(self, key, limit, window_seconds, now, reset_time):
        with self._lock:
            window = self._in_memory[key]
            window_start = now - window_seconds
            while window and window[0] < window_start:
                window.popleft()
            window.append(now)
            count = len(window)
            remaining = max(0, limit - count)
            return count <= limit, remaining, reset_time


# Global limiter instance
_limiter = SlidingWindowRateLimiter()


def init_rate_limiter(redis_client=None):
    """Initialize with Redis client."""
    global _limiter
    _limiter = SlidingWindowRateLimiter(redis_client)


# Default limits by endpoint type
DEFAULT_LIMITS = {
    "public": {"limit": 100, "window": 60},     # 100 req/min for public API
    "bot": {"limit": 1000, "window": 60},       # 1000 req/min for bots
    "auth": {"limit": 10, "window": 60},        # 10 req/min for auth
    "upload": {"limit": 20, "window": 60},      # 20 req/min for uploads
}


def _get_client_id():
    """Get client identifier for rate limiting."""
    # Bot token if present
    auth = request.headers.get("Authorization") or ""
    if auth.startswith("Bot "):
        return f"bot:{auth[4:][:20]}"
    # API key
    api_key = request.headers.get("X-API-Key")
    if api_key:
        return f"apikey:{api_key[:20]}"
    # JWT token
    if auth.startswith("Bearer "):
        return f"jwt:{auth[7:][:20]}"
    # Fallback to IP
    return f"ip:{request.remote_addr}"


def _get_limit_type():
    """Determine rate limit type from request path."""
    path = request.path
    if "/auth" in path:
        return "auth"
    if "/upload" in path:
        return "upload"
    if request.headers.get("Authorization", "").startswith("Bot "):
        return "bot"
    return "public"


def rate_limit_headers():
    """Flask before_request handler that enforces rate limits and adds headers."""
    # Skip health checks and metrics
    if request.path in ("/health", "/metrics", "/favicon.ico"):
        return

    limit_type = _get_limit_type()
    config = DEFAULT_LIMITS.get(limit_type, DEFAULT_LIMITS["public"])

    client_id = _get_client_id()
    key = f"ratelimit:{limit_type}:{client_id}"

    allowed, remaining, reset_time = _limiter.check(
        key, config["limit"], config["window"]
    )

    # Store in g for after_request to add headers
    g.rate_limit_limit = config["limit"]
    g.rate_limit_remaining = remaining
    g.rate_limit_reset = reset_time

    if not allowed:
        from app.api.v2.errors import rate_limited
        retry_after = reset_time - int(time.time())
        return rate_limited(retry_after=max(1, retry_after))


def add_rate_limit_headers(response):
    """Flask after_request handler to add rate limit headers."""
    if hasattr(g, "rate_limit_limit"):
        response.headers["X-RateLimit-Limit"] = str(g.rate_limit_limit)
        response.headers["X-RateLimit-Remaining"] = str(g.rate_limit_remaining)
        response.headers["X-RateLimit-Reset"] = str(g.rate_limit_reset)
    response.headers["X-Request-Id"] = str(
        getattr(g, "request_id", "")
    )
    return response
