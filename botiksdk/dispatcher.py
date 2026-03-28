import asyncio
import logging
from typing import Any, Dict, Iterable, Optional

from botiksdk.bot_types import CallbackQuery, Message, Update
from botiksdk.filters import BaseFilter
from botiksdk.router import Handler, Router

logger = logging.getLogger(__name__)


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

    def include_router(self, router: Router):
        self._routers.append(router)
        return self

    def message(self, *filters: BaseFilter, state: Optional[str] = None):
        return self._routers[0].message(*filters, state=state)

    def callback_query(self, *filters: BaseFilter, state: Optional[str] = None):
        return self._routers[0].callback_query(*filters, state=state)

    def fsm_context(self, user_id: str, chat_id: str) -> FSMContext:
        return FSMContext(self._fsm_storage, user_id, chat_id)

    async def feed_update(self, bot, update: Update):
        if update is None:
            return

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

    async def _dispatch_message(self, bot, message: Message):
        user_id = str(message.from_user.id) if message.from_user else ""
        chat_id = str(message.chat.id) if message.chat else ""
        fsm = self.fsm_context(user_id, chat_id)
        current_state = await fsm.get_state()

        for router in self._routers:
            for handler in router.message_handlers:
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
                    await handler.callback(message, bot, fsm)
                    return  # Only one handler per message

    async def _dispatch_callback_query(self, bot, callback_query: CallbackQuery):
        user_id = str(callback_query.from_user.id) if callback_query.from_user else ""
        chat_id = str(callback_query.message.chat.id) if callback_query.message else ""
        fsm = self.fsm_context(user_id, chat_id)
        current_state = await fsm.get_state()

        for router in self._routers:
            for handler in router.callback_handlers:
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
                    await handler.callback(callback_query, bot, fsm)
                    return  # Only one handler per callback

    async def _check_filters(
            self,
            filters: Iterable[BaseFilter],
            obj) -> bool:
        for f in filters:
            result = f(obj)
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
                updates = bot.get_updates(offset=offset, timeout=20, limit=100)
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
