import asyncio
import os

from botiksdk import Bot, Command, Dispatcher


async def main():
    bot_id = ''
    bot_token = ''
    base_url = ''

    bot = Bot(bot_id=bot_id, token=bot_token, base_url=base_url)
    dp = Dispatcher()

    @dp.message(Command("start"))
    async def start_handler(message, bot_instance):
        await asyncio.to_thread(
            bot_instance.send_message,
            message.chat.id,
            "Привет! Команды: /id /help",
        )

    @dp.message(Command("id"))
    async def id_handler(message, bot_instance):
        user_id = message.from_user.id if message.from_user else "unknown"
        await asyncio.to_thread(
            bot_instance.send_message,
            message.chat.id,
            f"Ваш id: {user_id}",
        )

    @dp.message(Command("help"))
    async def help_handler(message, bot_instance):
        await asyncio.to_thread(
            bot_instance.send_message,
            message.chat.id,
            "Доступные команды: /start /id /help",
        )

    await dp.start_polling(bot)


if __name__ == "__main__":
    asyncio.run(main())
