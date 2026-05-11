import asyncio
import re
import time
from typing import Any, Iterable, Optional


class BaseFilter:
    def __call__(self, message) -> bool:
        return True

    def __and__(self, other):
        return CombinedFilter(self, other, op="and")

    def __or__(self, other):
        return CombinedFilter(self, other, op="or")

    def __invert__(self):
        return NegatedFilter(self)


class CombinedFilter(BaseFilter):
    def __init__(self, left, right, op: str):
        self.left = left
        self.right = right
        self.op = op

    def __call__(self, message) -> bool:
        left_result = self.left(message)
        right_result = self.right(message)
        if asyncio.iscoroutine(left_result) or asyncio.iscoroutine(right_result):
            return self._async_eval(left_result, right_result)
        if self.op == "and":
            return bool(left_result) and bool(right_result)
        return bool(left_result) or bool(right_result)

    async def _async_eval(self, left_result, right_result):
        if asyncio.iscoroutine(left_result):
            left_result = await left_result
        if self.op == "and" and not left_result:
            return False
        if asyncio.iscoroutine(right_result):
            right_result = await right_result
        if self.op == "and":
            return bool(left_result) and bool(right_result)
        return bool(left_result) or bool(right_result)


class NegatedFilter(BaseFilter):
    def __init__(self, inner):
        self.inner = inner

    def __call__(self, message) -> bool:
        result = self.inner(message)
        if asyncio.iscoroutine(result):
            return self._async_eval(result)
        return not bool(result)

    async def _async_eval(self, result):
        return not bool(await result)


class Command(BaseFilter):
    def __init__(self, *commands: str, prefix: str = "/"):
        self.commands = {c.lstrip(prefix).lower() for c in commands if c}
        self.prefix = prefix

    def __call__(self, message) -> bool:
        text = getattr(message, "text", None)
        if not text:
            return False
        if not text.startswith(self.prefix):
            return False
        cmd = text[len(self.prefix):].split()[0].lower()
        if not self.commands:
            return True
        return cmd in self.commands


class Text(BaseFilter):
    def __init__(
            self,
            equals: Optional[str] = None,
            contains: Optional[str] = None):
        self.equals = equals
        self.contains_value = contains

    def __call__(self, message) -> bool:
        text = getattr(message, "text", None)
        if text is None:
            return False
        if self.equals is not None:
            return text == self.equals
        if self.contains_value is not None:
            return self.contains_value in text
        return True


class CallbackDataFilter(BaseFilter):
    """Filter for callback queries by data pattern"""

    def __init__(self, prefix: str = ""):
        self.prefix = prefix

    def __call__(self, obj) -> bool:
        # Can be called with Message or CallbackQuery
        callback_query = getattr(obj, "callback_query", None)
        if callback_query:
            data = callback_query.data
        elif hasattr(obj, "data"):
            data = obj.data
        else:
            return False

        if not self.prefix:
            return True
        return data.startswith(self.prefix)


class Regex(BaseFilter):
    def __init__(self, pattern: str, flags: int = 0):
        self.pattern = re.compile(pattern, flags=flags)

    def __call__(self, message) -> bool:
        text = getattr(message, "text", None)
        if not text:
            return False
        return self.pattern.search(text) is not None


class RateLimit(BaseFilter):
    """
    Simple in-memory anti-flood filter.
    Allows one event per key for `window_seconds`.
    """

    def __init__(self, window_seconds: float = 1.0, key: str = "user"):
        self.window_seconds = max(0.0, window_seconds)
        self.key = key
        self._last_seen: dict[str, float] = {}

    def __call__(self, event) -> bool:
        now = time.monotonic()
        rate_key = self._resolve_key(event)
        last_seen = self._last_seen.get(rate_key)
        if last_seen is not None and (now - last_seen) < self.window_seconds:
            return False
        self._last_seen[rate_key] = now
        return True

    def _resolve_key(self, event) -> str:
        if self.key == "chat":
            chat = getattr(event, "chat", None)
            if chat is None and hasattr(event, "message") and event.message:
                chat = getattr(event.message, "chat", None)
            chat_id = getattr(chat, "id", "unknown_chat")
            return f"chat:{chat_id}"

        user = getattr(event, "from_user", None)
        if user is None and hasattr(event, "message") and event.message:
            user = getattr(event.message, "from_user", None)
        user_id = getattr(user, "id", "unknown_user")
        return f"user:{user_id}"


class FilterExpression(BaseFilter):
    def __init__(self, getter, op: str, value: Any):
        self.getter = getter
        self.op = op
        self.value = value

    def __call__(self, message) -> bool:
        current = self.getter(message)
        if self.op == "eq":
            return current == self.value
        if self.op == "contains":
            return current is not None and self.value in current
        if self.op == "in":
            return current in self.value
        return False


class FieldRef:
    def __init__(self, path: Iterable[str]):
        self.path = tuple(path)

    def __getattr__(self, name: str):
        return FieldRef(self.path + (name,))

    def _get_value(self, message):
        current = message
        for name in self.path:
            if current is None:
                return None
            current = getattr(current, name, None)
        return current

    def __eq__(self, other):
        return FilterExpression(self._get_value, "eq", other)

    def contains(self, value):
        return FilterExpression(self._get_value, "contains", value)

    def isin(self, values):
        return FilterExpression(self._get_value, "in", values)


class FieldAccessor:
    def __getattr__(self, name: str):
        return FieldRef((name,))


F = FieldAccessor()
