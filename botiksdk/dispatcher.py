import asyncio
import inspect
import logging
from typing import Any, Dict, Iterable, Optional, Mapping

from botiksdk.bot_types import CallbackQuery, Message, Update
from botiksdk.filters import BaseFilter
from botiksdk.router import Handler, Router

logger = logging.getLogger(__name__)
MiddlewareCallable = Any


class FSMContext:
    """Finite State Machine Context"""

    def __init__(self, storage: "FSMStorage", user_id: str, chat_id: str):
        self._storage = storage
        self._user_id = user_id
        self._chat_id = chat_id

    async def set_state(self, state: Optional[str]):
        await self._storage.set_state(self._user_id, self._chat_id, state)

    async def get_state(self) -> Optional[str]:
        return await self._storage.get_state(self._user_id, self._chat_id)

    async def set_data(self, data: Dict[str, Any]):
        await self._storage.set_data(self._user_id, self._chat_id, data)

    async def get_data(self) -> Dict[str, Any]:
        return await self._storage.get_data(self._user_id, self._chat_id)

    async def update_data(self, data: Dict[str, Any]):
        current = await self.get_data()
        current.update(data)
        await self.set_data(current)

    async def clear(self):
        await self._storage.clear(self._user_id, self._chat_id)


class FSMStorage:
    """In-memory FSM storage (use database in production)"""

    def __init__(self):
        self._states: Dict[str, Optional[str]] = {}
        self._data: Dict[str, Dict[str, Any]] = {}

    def _make_key(self, user_id: str, chat_id: str) -> str:
        return f"{user_id}:{chat_id}"

    async def set_state(self, user_id: str, chat_id: str, state: Optional[str]):
        key = self._make_key(user_id, chat_id)
        self._states[key] = state

    async def get_state(self, user_id: str, chat_id: str) -> Optional[str]:
        key = self._make_key(user_id, chat_id)
        return self._states.get(key)

    async def set_data(self, user_id: str, chat_id: str, data: Dict[str, Any]):
        key = self._make_key(user_id, chat_id)
        self._data[key] = data

    async def get_data(self, user_id: str, chat_id: str) -> Dict[str, Any]:
        key = self._make_key(user_id, chat_id)
        return self._data.get(key, {})

    async def clear(self, user_id: str, chat_id: str):
        key = self._make_key(user_id, chat_id)
        self._states.pop(key, None)
        self._data.pop(key, None)


class Dispatcher:
    def __init__(self):
        self._routers = [Router()]
        self._fsm_storage = FSMStorage()
        self._error_handlers = []
        self._message_middlewares = []
        self._callback_middlewares = []

    def include_router(self, router: Router):
        self._routers.append(router)
        return self

    def message(
        self,
        *filters: BaseFilter,
        state: Optional[str] = None,
        priority: int = 0,
        blocking: bool = True,
    ):
        return self._routers[0].message(
            *filters, state=state, priority=priority, blocking=blocking
        )

    def callback_query(
        self,
        *filters: BaseFilter,
        state: Optional[str] = None,
        priority: int = 0,
        blocking: bool = True,
    ):
        return self._routers[0].callback_query(
            *filters, state=state, priority=priority, blocking=blocking
        )

    def fsm_context(self, user_id: str, chat_id: str) -> FSMContext:
        return FSMContext(self._fsm_storage, user_id, chat_id)

    def errors(self):
        def decorator(func):
            self._error_handlers.append(func)
            return func

        return decorator

    def message_middleware(self):
        def decorator(func):
            self._message_middlewares.append(func)
            return func

        return decorator

    def callback_query_middleware(self):
        def decorator(func):
            self._callback_middlewares.append(func)
            return func

        return decorator

    async def feed_update(self, bot, update: Update):
        if update is None:
            return
        try:
            # Handle callback query
            if update.callback_query:
                await self._dispatch_callback_query(bot, update.callback_query)
                return

            # Handle message
            message = update.message
            if message is not None:
                logger.info(
                    "botiksdk_update_received bot_id=%s update_id=%s text=%s",
                    getattr(bot, "bot_id", None),
                    update.update_id,
                    message.text,
                )
                await self._dispatch_message(bot, message)
        except Exception as exc:
            await self._handle_error(exc, update, bot)

    async def _dispatch_message(self, bot, message: Message):
        user_id = str(message.from_user.id) if message.from_user else ""
        chat_id = str(message.chat.id) if message.chat else ""
        fsm = self.fsm_context(user_id, chat_id)
        current_state = await fsm.get_state()

        handlers = self._sorted_handlers("message")
        for handler in handlers:
                # Check state filter
                if handler.state is not None and handler.state != current_state:
                    continue

                if await self._check_filters(handler.filters, message):
                    logger.info(
                        "botiksdk_handler_matched bot_id=%s text=%s state=%s",
                        getattr(bot, "bot_id", None),
                        message.text,
                        current_state,
                    )
                    handled = await self._run_middlewares(
                        "message",
                        event=message,
                        bot=bot,
                        state=fsm,
                        current_state=current_state,
                        handler=handler,
                    )
                    if handled and handler.blocking:
                        return

    async def _dispatch_callback_query(self, bot, callback_query: CallbackQuery):
        user_id = str(callback_query.from_user.id) if callback_query.from_user else ""
        chat_id = str(callback_query.message.chat.id) if callback_query.message else ""
        fsm = self.fsm_context(user_id, chat_id)
        current_state = await fsm.get_state()

        handlers = self._sorted_handlers("callback_query")
        for handler in handlers:
                # Check state filter
                if handler.state is not None and handler.state != current_state:
                    continue

                if await self._check_filters(handler.filters, callback_query):
                    logger.info(
                        "botiksdk_callback_handler_matched bot_id=%s data=%s state=%s",
                        getattr(bot, "bot_id", None),
                        callback_query.data,
                        current_state,
                    )
                    handled = await self._run_middlewares(
                        "callback_query",
                        event=callback_query,
                        bot=bot,
                        state=fsm,
                        current_state=current_state,
                        handler=handler,
                    )
                    if handled and handler.blocking:
                        return

    def _sorted_handlers(self, event_name: str):
        handlers = []
        for router in self._routers:
            if event_name == "message":
                handlers.extend(router.message_handlers)
            else:
                handlers.extend(router.callback_handlers)
        return sorted(handlers, key=lambda h: h.priority, reverse=True)

    async def _run_middlewares(
        self,
        event_name: str,
        *,
        event,
        bot,
        state: FSMContext,
        current_state: Optional[str],
        handler: Handler,
    ) -> bool:
        middlewares = (
            self._message_middlewares
            if event_name == "message"
            else self._callback_middlewares
        )
        context = {
            "event": event,
            event_name: event,
            "bot": bot,
            "state": state,
            "current_state": current_state,
            "handler": handler,
            "dispatcher": self,
        }
        return await self._execute_middleware_chain(
            middlewares=middlewares,
            context=context,
            handler=handler,
            event_name=event_name,
            event=event,
            bot=bot,
            state=state,
        )

    async def _execute_middleware_chain(
        self,
        *,
        middlewares,
        context: Dict[str, Any],
        handler: Handler,
        event_name: str,
        event,
        bot,
        state: FSMContext,
    ) -> bool:
        async def call_handler():
            await self._invoke_handler(
                handler,
                event=event,
                bot=bot,
                state=state,
                event_name=event_name,
            )
            return True

        next_callable = call_handler
        for middleware in reversed(middlewares):
            current_next = next_callable

            async def wrapped(mw=middleware, nxt=current_next):
                return await self._invoke_middleware(mw, context, nxt)

            next_callable = wrapped
        return await next_callable()

    async def _invoke_middleware(
        self,
        middleware: MiddlewareCallable,
        context: Dict[str, Any],
        call_next,
    ):
        signature = inspect.signature(middleware)
        kwargs: Dict[str, Any] = {}
        for param in signature.parameters.values():
            if param.name == "call_next":
                kwargs[param.name] = call_next
            elif param.name in context:
                kwargs[param.name] = context[param.name]
        result = middleware(**kwargs)
        if inspect.isawaitable(result):
            return await result
        return result

    async def _invoke_handler(
        self,
        handler: Handler,
        *,
        event,
        bot,
        state: FSMContext,
        event_name: str,
    ):
        callback = handler.callback
        signature = inspect.signature(callback)
        args = []
        kwargs: Dict[str, Any] = {}

        reserved_names: Mapping[str, Any] = {
            event_name: event,
            "event": event,
            "message": event if event_name == "message" else None,
            "callback": event if event_name == "callback_query" else None,
            "callback_query": event if event_name == "callback_query" else None,
            "bot": bot,
            "state": state,
            "fsm": state,
            "dispatcher": self,
            "dp": self,
        }

        for param in signature.parameters.values():
            value = reserved_names.get(param.name, None)
            if value is None and param.name in ("message", "callback", "callback_query"):
                continue
            if param.kind in (
                inspect.Parameter.POSITIONAL_ONLY,
                inspect.Parameter.POSITIONAL_OR_KEYWORD,
            ):
                if value is not None:
                    args.append(value)
                elif param.default is inspect.Parameter.empty:
                    if param.name in ("message", "callback", "callback_query", "event"):
                        args.append(event)
                    elif param.name in ("bot",):
                        args.append(bot)
                    elif param.name in ("state", "fsm"):
                        args.append(state)
            elif param.kind == inspect.Parameter.KEYWORD_ONLY and value is not None:
                kwargs[param.name] = value

        result = callback(*args, **kwargs)
        if inspect.isawaitable(result):
            await result

    async def _handle_error(self, exc: Exception, update: Update, bot):
        logger.exception(
            "botiksdk_dispatch_exception bot_id=%s update_id=%s",
            getattr(bot, "bot_id", None),
            getattr(update, "update_id", None),
            exc_info=exc,
        )
        if not self._error_handlers:
            raise exc

        for callback in self._error_handlers:
            signature = inspect.signature(callback)
            kwargs: Dict[str, Any] = {}
            for param in signature.parameters.values():
                if param.name in ("exception", "error", "exc"):
                    kwargs[param.name] = exc
                elif param.name == "update":
                    kwargs[param.name] = update
                elif param.name == "bot":
                    kwargs[param.name] = bot
                elif param.name in ("dispatcher", "dp"):
                    kwargs[param.name] = self
            result = callback(**kwargs)
            if inspect.isawaitable(result):
                await result

    async def _check_filters(
            self,
            filters: Iterable[BaseFilter],
            obj) -> bool:
        for f in filters:
            predicate = f
            if not callable(predicate):
                return False
            result = predicate(obj)
            if asyncio.iscoroutine(result):
                result = await result
            if not result:
                return False
        return True

    async def start_polling(self, *bots):
        tasks = []
        for bot in bots:
            tasks.append(asyncio.create_task(self._poll_bot(bot)))
        if not tasks:
            return
        await asyncio.gather(*tasks)

    async def start_webhook(self, *bots, **kwargs):
        raise NotImplementedError(
            "Public API does not support webhook updates")

    async def _poll_bot(self, bot):
        offset = 0
        while True:
            try:
                updates = await bot.get_updates(offset=offset, timeout=20, limit=100)
            except Exception:
                logger.exception(
                    "botiksdk_poll_error bot_id=%s", getattr(
                        bot, "bot_id", None)
                )
                await asyncio.sleep(1)
                continue
            if not updates:
                await asyncio.sleep(0.2)
                continue
            for raw in updates:
                update = Update.from_dict(raw)
                if update is None:
                    continue
                await self.feed_update(bot, update)
                try:
                    offset = max(offset, int(update.update_id))
                except Exception:
                    offset = offset
