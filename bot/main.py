import asyncio
import logging
import os
import sys

from aiogram import Bot, Dispatcher, F, types
from aiogram.filters import Command
from aiogram.types import InlineKeyboardButton
from aiogram.utils.keyboard import InlineKeyboardBuilder
from bcrypter.service import BCrypter
from dotenv import load_dotenv

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)
load_dotenv(".env.bot")
BOT_TOKEN = os.getenv("BOT_TOKEN")
dp = Dispatcher()
bcrypter = BCrypter()


@dp.message(Command("start"))
async def cmd_start(message: types.Message):
    """
    Обработчик команды /start.
    Отправляет приветственное сообщение с инлайн-кнопками.
    """
    builder = InlineKeyboardBuilder()
    builder.add(InlineKeyboardButton(
        text="Регистрация", callback_data="register"))
    builder.add(
        InlineKeyboardButton(
            text="Войти / Восстановить ключ", callback_data="restore")
    )
    builder.adjust(1)
    await message.answer(
        "Добро пожаловать! Выберите действие:", reply_markup=builder.as_markup()
    )


@dp.callback_query(F.data == "register")
async def register_user(callback: types.CallbackQuery):
    """
    Обработчик нажатия на кнопку "Регистрация".
    """
    user_id = str(callback.from_user.id)
    username = callback.from_user.username or f"user_{user_id}"
    if bcrypter.is_user_registered(user_id):
        await callback.message.answer(
            "Вы уже зарегистрированы. Используйте 'Войти / Восстановить ключ', если забыли ключ."
        )
        await callback.answer()
        return
    key = bcrypter.register_user(user_id, username)
    if key:
        await callback.message.answer(
            f"✅ Вы успешно зарегистрированы!\n\n🔑 Ваш секретный ключ:\n`{user_id}:{key}`\n\n⚠️ Сохраните его, он показывается только один раз!\nИспользуйте этот ключ для авторизации на сайте.",
            parse_mode="Markdown",
        )
    else:
        await callback.message.answer(
            "❌ Произошла ошибка при регистрации. Возможно, такое имя пользователя уже занято."
        )
    await callback.answer()


@dp.callback_query(F.data == "restore")
async def restore_key(callback: types.CallbackQuery):
    """
    Обработчик нажатия на кнопку "Войти / Восстановить ключ".
    """
    user_id = str(callback.from_user.id)
    if not bcrypter.is_user_registered(user_id):
        await callback.message.answer(
            "⚠️ Вы еще не зарегистрированы. Нажмите 'Регистрация'."
        )
        await callback.answer()
        return
    key = bcrypter.rotate_key(user_id)
    if key:
        await callback.message.answer(
            f"🔄 Ваш ключ был обновлен!\n\n🔑 Новый секретный ключ:\n`{user_id}:{key}`\n\n⚠️ Старый ключ больше недействителен.",
            parse_mode="Markdown",
        )
    else:
        await callback.message.answer("❌ Произошла ошибка при обновлении ключа.")
    await callback.answer()


async def main():
    if not BOT_TOKEN:
        logger.error(
            "BOT_TOKEN не установлен. Пожалуйста, укажите его в переменных окружения или файле .env."
        )
        return
    bot = Bot(token=BOT_TOKEN)
    logger.info("Запуск бота...")
    await dp.start_polling(bot)


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        pass
