"""
Rate limiting and spam protection for the Vondic API.
"""
import hashlib
import time
from collections import defaultdict, deque
from functools import wraps


class RateLimiter:
    """
    Rate limiting system to prevent DDoS and spam attacks.
    """

    def __init__(self, redis_client=None):
        self.redis_client = redis_client
        # In-memory fallback if Redis is not available
        self.requests = defaultdict(deque)
        self.blocked_ips = set()
        self.spam_patterns = set()

    def is_rate_limited(self, identifier: str, limit: int,
                        window: int) -> tuple[bool, int]:
        """
        Check if the identifier has exceeded the rate limit.

        Args:
            identifier: Unique identifier (IP, user_id, etc.)
            limit: Max requests allowed
            window: Time window in seconds

        Returns:
            Tuple of (is_limited, time_until_reset)
        """
        current_time = time.time()

        if self.redis_client:
            # Use Redis for distributed rate limiting
            key = f"rate_limit:{identifier}"
            pipe = self.redis_client.pipeline()

            # Clean old entries
            pipe.zremrangebyscore(key, 0, current_time - window)
            # Add current request
            pipe.zadd(key, {str(current_time): current_time})
            # Count requests in window
            pipe.zcard(key)
            # Set expiration
            pipe.expire(key, window)

            results = pipe.execute()
            request_count = results[2]

            if request_count > limit:
                # Calculate reset time
                oldest_req = self.redis_client.zrange(
                    key, 0, 0, withscores=True)
                if oldest_req:
                    reset_time = int(oldest_req[0][1]) + window
                    return True, max(0, reset_time - int(current_time))
                return True, window
        else:
            # Fallback to in-memory rate limiting
            now = time.time()
            # Remove requests older than window
            while self.requests[identifier] and self.requests[identifier][0] <= now - window:
                self.requests[identifier].popleft()

            # Add current request
            self.requests[identifier].append(now)

            if len(self.requests[identifier]) > limit:
                # Calculate reset time
                oldest = self.requests[identifier][0]
                reset_time = int(oldest + window)
                return True, max(0, reset_time - int(now))

        return False, 0

    def is_blocked_ip(self, ip_address: str) -> bool:
        """
        Check if IP is blocked.
        """
        return ip_address in self.blocked_ips

    def block_ip(self, ip_address: str, duration: int = 3600):
        """
        Block an IP address for a specified duration.
        """
        self.blocked_ips.add(ip_address)
        # In a real system, this would persist in Redis/database
        if self.redis_client:
            self.redis_client.setex(
                f"blocked_ip:{ip_address}", duration, "true")

    def is_spam_content(self, content: str) -> bool:
        """
        Basic spam content detection.
        """
        content_lower = content.lower()

        # Check for spam patterns
        spam_keywords = [
            'free money', 'click here', 'buy now', 'limited time',
            'urgent', 'act now', 'winner', 'congratulations',
            'you have won', 'guaranteed', 'no obligation'
        ]

        for keyword in spam_keywords:
            if keyword in content_lower:
                return True

        # Check for excessive repetition
        words = content.split()
        if len(words) > 0:
            word_freq = {}
            for word in words:
                clean_word = word.strip('.,!?;:"').lower()
                word_freq[clean_word] = word_freq.get(clean_word, 0) + 1
                # More than 30% repetition
                if word_freq[clean_word] / len(words) > 0.3:
                    return True

        # Check for excessive capitalization
        caps_ratio = sum(1 for c in content if c.isupper()) / len(content)
        if caps_ratio > 0.7:  # More than 70% uppercase
            return True

        return False


# Global rate limiter instance
rate_limiter = RateLimiter()


def get_client_ip(request):
    """
    Extract client IP from request, considering proxies.
    """
    forwarded_for = request.headers.get('X-Forwarded-For')
    if forwarded_for:
        return forwarded_for.split(',')[0].strip()
    return request.environ.get('REMOTE_ADDR')


def rate_limit(limit: int, window: int, per_user: bool = False):
    """
    Decorator for rate limiting API endpoints.
    """
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            from flask import jsonify, request

            # Get identifier based on configuration
            if per_user:
                # The current_user is passed as an argument to the decorated function
                # Usually it's the last positional argument before kwargs
                current_user = None
                if args:
                    # Look for the current_user among the arguments
                    # It's usually the last argument in token_required
                    # decorated functions
                    for arg in reversed(args):
                        if hasattr(
                                arg, 'id'):  # Assume user objects have an id attribute
                            current_user = arg
                            break
                identifier = getattr(
                    current_user, 'id', 'anonymous') if current_user else 'anonymous'
            else:
                identifier = get_client_ip(request)

            is_limited, time_left = rate_limiter.is_rate_limited(
                identifier, limit, window)

            if is_limited:
                return jsonify({
                    'success': False,
                    'error': 'Rate limit exceeded',
                    'message': f'Too many requests. Try again in {time_left} seconds.',
                    'retry_after': time_left
                }), 429

            return func(*args, **kwargs)
        return wrapper
    return decorator


def check_spam_protection(content: str) -> tuple[bool, str]:
    """
    Check if content violates spam protection rules.

    Returns:
        Tuple of (is_spam, reason)
    """
    if rate_limiter.is_spam_content(content):
        return True, "Content contains spam patterns"

    # Check for duplicate content recently posted by same user
    content_hash = hashlib.sha256(content.encode()).hexdigest()
    if content_hash in rate_limiter.spam_patterns:
        return True, "Duplicate content detected"

    return False, ""
