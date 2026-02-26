import asyncio
import logging
from typing import Iterable

from botiksdk.bot_types import Message, Update
from botiksdk.filters import BaseFilter
from botiksdk.router import Router


class Dispatcher:
    def __init__(self):
        self._routers = [Router()]

    def include_router(self, router: Router):
        self._routers.append(router)
        return self

    def message(self, *filters: BaseFilter):
        return self._routers[0].message(*filters)

    async def feed_update(self, bot, update: Update):
        if update is None:
            return
        message = update.message
        if message is not None:
            logging.getLogger(__name__).info(
                "botiksdk_update_received bot_id=%s update_id=%s text=%s",
                getattr(bot, "bot_id", None),
                update.update_id,
                message.text,
            )
            await self._dispatch_message(bot, message)

    async def _dispatch_message(self, bot, message: Message):
        for router in self._routers:
            for handler in router.message_handlers:
                if await self._check_filters(handler.filters, message):
                    logging.getLogger(__name__).info(
                        "botiksdk_handler_matched bot_id=%s text=%s",
                        getattr(bot, "bot_id", None),
                        message.text,
                    )
                    await handler.callback(message, bot)

    async def _check_filters(
            self,
            filters: Iterable[BaseFilter],
            message: Message):
        for f in filters:
            result = f(message)
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
            "Public API does not provide webhook updates")

    async def _poll_bot(self, bot):
        offset = 0
        while True:
            try:
                updates = bot.get_updates(offset=offset, timeout=20, limit=100)
            except Exception:
                logging.getLogger(__name__).exception(
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
