import re
from typing import Any, Iterable, Optional


class BaseFilter:
    def __call__(self, message) -> bool:
        return True


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
    def __init__(self, equals: Optional[str] = None, contains: Optional[str] = None):
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


class Regex(BaseFilter):
    def __init__(self, pattern: str, flags: int = 0):
        self.pattern = re.compile(pattern, flags=flags)

    def __call__(self, message) -> bool:
        text = getattr(message, "text", None)
        if not text:
            return False
        return self.pattern.search(text) is not None


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
