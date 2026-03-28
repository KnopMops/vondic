from dataclasses import dataclass
from typing import Awaitable, Callable, List, Optional

from botiksdk.filters import BaseFilter

HandlerCallable = Callable[..., Awaitable[None]]


@dataclass
class Handler:
    filters: List[BaseFilter]
    callback: HandlerCallable
    state: Optional[str] = None


class Router:
    def __init__(self):
        self.message_handlers: List[Handler] = []
        self.callback_handlers: List[Handler] = []

    def message(self, *filters: BaseFilter, state: Optional[str] = None):
        def decorator(func: HandlerCallable):
            self.message_handlers.append(
                Handler(filters=list(filters), callback=func, state=state))
            return func

        return decorator

    def callback_query(self, *filters: BaseFilter, state: Optional[str] = None):
        def decorator(func: HandlerCallable):
            self.callback_handlers.append(
                Handler(filters=list(filters), callback=func, state=state))
            return func

        return decorator

    def include_router(self, router: "Router"):
        self.message_handlers.extend(router.message_handlers)
        self.callback_handlers.extend(router.callback_handlers)
        return self
