from dataclasses import dataclass
from typing import Awaitable, Callable, List

from botiksdk.filters import BaseFilter

HandlerCallable = Callable[..., Awaitable[None]]


@dataclass
class Handler:
    filters: List[BaseFilter]
    callback: HandlerCallable


class Router:
    def __init__(self):
        self.message_handlers: List[Handler] = []

    def message(self, *filters: BaseFilter):
        def decorator(func: HandlerCallable):
            self.message_handlers.append(
                Handler(filters=list(filters), callback=func))
            return func

        return decorator

    def include_router(self, router: "Router"):
        self.message_handlers.extend(router.message_handlers)
        return self
