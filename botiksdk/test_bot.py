import asyncio
import logging
import os

from botiksdk import Bot, Command, Dispatcher

async def main():
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
    )
    bot_id = os.environ.get(
        "BOTIK_BOT_ID", "eee845bc-8bf7-49da-9ec9-304832e9189b")
    bot_token = os.environ.get(
        "BOTIK_BOT_TOKEN", "ktybQlSZb6xX5FH3j9FoeUKa79xCTUx3Gsio9_5dW3Y"
    )
    base_url = os.environ.get("BOTIK_BASE_URL", "http://localhost:5050")
    logging.getLogger(__name__).info(
        "botiksdk_config bot_id=%s base_url=%s", bot_id, base_url
    )

    bot = Bot(bot_id=bot_id, token=bot_token, base_url=base_url)
    dp = Dispatcher()

    @dp.message(Command("start"))
    async def start_handler(message, bot_instance):
        logging.getLogger(__name__).info(
            "handler_start chat_id=%s", message.chat.id)
        result = await asyncio.to_thread(
            bot_instance.send_message,
            message.chat.id,
            "Привет! Команды: /id /help",
        )
        logging.getLogger(__name__).info("handler_start_result %s", result)

    @dp.message(Command("id"))
    async def id_handler(message, bot_instance):
        user_id = message.from_user.id if message.from_user else "unknown"
        logging.getLogger(__name__).info(
            "handler_id chat_id=%s", message.chat.id)
        result = await asyncio.to_thread(
            bot_instance.send_message,
            message.chat.id,
            f"Ваш id: {user_id}",
        )
        logging.getLogger(__name__).info("handler_id_result %s", result)

    @dp.message(Command("help"))
    async def help_handler(message, bot_instance):
        logging.getLogger(__name__).info(
            "handler_help chat_id=%s", message.chat.id)
        result = await asyncio.to_thread(
            bot_instance.send_message,
            message.chat.id,
            "Доступные команды: /start /id /help",
        )
        logging.getLogger(__name__).info("handler_help_result %s", result)

    await dp.start_polling(bot)

if __name__ == "__main__":
    asyncio.run(main())
