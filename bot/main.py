import asyncio
import logging
import os
import sys

import aiohttp
from aiogram import Bot, Dispatcher, F, types
from aiogram.filters import Command
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup
from aiogram.types import InlineKeyboardButton
from aiogram.utils.keyboard import InlineKeyboardBuilder
from bcrypter.service import BCrypter
from dotenv import load_dotenv

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)
load_dotenv(".env.bot")
BOT_TOKEN = os.getenv("BOT_TOKEN")
BACKEND_URL = os.getenv("BACKEND_URL", "http://127.0.0.1:5050")
dp = Dispatcher()
bcrypter = BCrypter()


class AuthStates(StatesGroup):
    email = State()
    password = State()


class CoinsStates(StatesGroup):
    email = State()


class LinkStates(StatesGroup):
    waiting_for_key = State()


@dp.message(Command("start"))
async def cmd_start(message: types.Message):
    builder = InlineKeyboardBuilder()

    builder.row(InlineKeyboardButton(
        text="✅ Регистрация", callback_data="register"))

    builder.row(
        InlineKeyboardButton(
            text="🔄 Войти / Восстановить ключ", callback_data="restore"
        )
    )

    builder.row(
        InlineKeyboardButton(
            text="💎 Купить Vondic Premium", callback_data="buy_premium_tg"
        )
    )
    builder.row(
        InlineKeyboardButton(text="💰 Купить Vondic Coins",
                             callback_data="buy_coins")
    )

    builder.row(
        InlineKeyboardButton(
            text="🚪 У меня нет Telegram аккаунта", callback_data="no_telegram"
        )
    )

    builder.row(
        InlineKeyboardButton(
            text="🔗 Привязать аккаунт (Yandex)", callback_data="link_yandex"
        )
    )

    await message.answer(
        "👋 Добро пожаловать в Vondic Bot!\n\nВыберите действие:",
        reply_markup=builder.as_markup(),
    )


@dp.callback_query(F.data == "buy_premium_tg")
async def buy_premium_tg_start(callback: types.CallbackQuery):
    user_id = str(callback.from_user.id)
    linked_user = None

    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(
                f"{BACKEND_URL}/api/v1/users/by-telegram/{user_id}"
            ) as response:
                if response.status == 200:
                    linked_user = await response.json()
    except Exception as e:
        logger.error(f"Error checking linked user: {e}")

    is_local_registered = bcrypter.is_user_registered(user_id)

    if not linked_user and not is_local_registered:
        builder = InlineKeyboardBuilder()
        builder.add(
            InlineKeyboardButton(text="✅ Зарегистрироваться",
                                 callback_data="register")
        )
        await callback.message.answer(
            "⚠️ Вы не зарегистрированы в системе.\nСначала пройдите регистрацию или привяжите существующий аккаунт, чтобы купить Premium.",
            reply_markup=builder.as_markup(),
        )
        await callback.answer()
        return

    target_user_id = linked_user["id"] if linked_user else user_id

    builder = InlineKeyboardBuilder()
    builder.add(
        InlineKeyboardButton(
            text="💳 Оплатить Premium",
            callback_data=f"buy_premium:{target_user_id}"))

    await callback.message.answer(
        "💎 **Vondic Premium**\n\n"
        "Преимущества:\n"
        "• ⭐ Уникальный значок профиля\n"
        "• 💾 5 ГБ облачного хранилища (вместо 1 ГБ)\n"
        "• 📁 Загрузка файлов до 100 МБ\n"
        "• 🖼️ GIF-аватарки (живые фото профиля)\n"
        "• 🚀 Приоритетная поддержка\n"
        "• 🎨 Расширенные возможности кастомизации\n\n"
        "Нажмите кнопку ниже, чтобы оформить подписку.",
        parse_mode="Markdown",
        reply_markup=builder.as_markup(),
    )
    await callback.answer()


@dp.callback_query(F.data == "buy_coins")
async def buy_coins_menu(callback: types.CallbackQuery):
    builder = InlineKeyboardBuilder()
    builder.row(
        InlineKeyboardButton(text="Для Telegram аккаунта",
                             callback_data="buy_coins_tg")
    )
    builder.row(
        InlineKeyboardButton(
            text="Для Yandex/Email аккаунта", callback_data="buy_coins_email"
        )
    )
    builder.row(
        InlineKeyboardButton(
            text="По Email (ввести адрес)", callback_data="buy_coins_email"
        )
    )
    await callback.message.answer(
        "Выберите, для какого аккаунта купить Vondic Coins:",
        reply_markup=builder.as_markup(),
    )
    await callback.answer()


@dp.callback_query(F.data == "buy_coins_tg")
async def buy_coins_tg(callback: types.CallbackQuery):
    user_id = str(callback.from_user.id)
    linked_user = None
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(
                f"{BACKEND_URL}/api/v1/users/by-telegram/{user_id}"
            ) as response:
                if response.status == 200:
                    linked_user = await response.json()
    except Exception as e:
        logger.error(f"Error checking linked user: {e}")
    if not linked_user:
        builder = InlineKeyboardBuilder()
        builder.add(
            InlineKeyboardButton(
                text="🔗 Привязать аккаунт (Yandex)",
                callback_data="link_yandex"))
        builder.add(
            InlineKeyboardButton(text="✅ Регистрация",
                                 callback_data="register")
        )
        await callback.message.answer(
            "Сначала привяжите или зарегистрируйте аккаунт, чтобы купить Vondic Coins.",
            reply_markup=builder.as_markup(),
        )
        await callback.answer()
        return
    target_user_id = linked_user["id"]
    builder = InlineKeyboardBuilder()
    builder.row(
        InlineKeyboardButton(
            text="100 coins (10 ₽)",
            callback_data=f"buy_coins_pack:{target_user_id}:100:1000",
        ),
        InlineKeyboardButton(
            text="500 coins (45 ₽)",
            callback_data=f"buy_coins_pack:{target_user_id}:500:4500",
        ),
        InlineKeyboardButton(
            text="2000 coins (150 ₽)",
            callback_data=f"buy_coins_pack:{target_user_id}:2000:15000",
        ),
    )
    await callback.message.answer(
        "Выберите пакет Vondic Coins:", reply_markup=builder.as_markup()
    )
    await callback.answer()


@dp.callback_query(F.data == "buy_coins_email")
async def buy_coins_email_start(
        callback: types.CallbackQuery,
        state: FSMContext):
    await state.set_state(CoinsStates.email)
    await callback.message.answer(
        "📧 Введите email аккаунта Vondic/Yandex для покупки монет:"
    )
    await callback.answer()


@dp.callback_query(F.data.startswith("buy_coins_pack"))
async def buy_coins_pack(callback: types.CallbackQuery):
    try:
        _, user_id, coins, amount = callback.data.split(":")
        async with aiohttp.ClientSession() as session:
            async with session.post(
                f"{BACKEND_URL}/api/v1/payments/create-coins-session",
                json={
                    "buyer_id": user_id,
                    "coins": int(coins),
                    "currency": "rub",
                    "success_url": "http://localhost:3000/shop/success",
                    "cancel_url": "http://localhost:3000/shop/cancel",
                },
            ) as response:
                if response.status == 200:
                    data = await response.json()
                    url = data.get("url")
                    if url:
                        builder = InlineKeyboardBuilder()
                        builder.add(InlineKeyboardButton(
                            text="💳 Оплатить", url=url))
                        await callback.message.answer(
                            "Перейдите к оплате:", reply_markup=builder.as_markup()
                        )
                    else:
                        await callback.message.answer("Ошибка получения ссылки.")
                else:
                    await callback.message.answer("Ошибка сервиса оплаты.")
    except Exception as e:
        logger.error(f"buy_coins_pack error: {e}")
        await callback.message.answer("Произошла ошибка.")
    await callback.answer()


@dp.callback_query(F.data == "register")
async def register_user(callback: types.CallbackQuery):
    user_id = str(callback.from_user.id)
    username = callback.from_user.username or f"user_{user_id}"

    avatar_url = None
    try:
        user_profile_photos = await callback.bot.get_user_profile_photos(
            callback.from_user.id, limit=1
        )
        if user_profile_photos.total_count > 0:
            file_id = user_profile_photos.photos[0][-1].file_id
            file = await callback.bot.get_file(file_id)
            if file.file_path:
                avatar_url = (
                    f"https://api.telegram.org/file/bot{BOT_TOKEN}/{file.file_path}"
                )
    except Exception as e:
        logger.error(f"Не удалось получить аватарку: {e}")

    if bcrypter.is_user_registered(user_id):
        await callback.message.answer(
            "Вы уже зарегистрированы. Используйте 'Войти / Восстановить ключ', если забыли ключ."
        )
        await callback.answer()
        return

    key = bcrypter.register_user(user_id, username, avatar_url)
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


@dp.message(CoinsStates.email)
async def buy_coins_email_entered(message: types.Message, state: FSMContext):
    email = message.text.strip()
    await state.clear()
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(
                f"{BACKEND_URL}/api/v1/users/by-email/{email}"
            ) as response:
                if response.status == 200:
                    user = await response.json()
                    user_id = user.get("id")
                    builder = InlineKeyboardBuilder()
                    builder.row(
                        InlineKeyboardButton(
                            text="100 coins (10 ₽)",
                            callback_data=f"buy_coins_pack:{user_id}:100:1000",
                        ),
                        InlineKeyboardButton(
                            text="500 coins (45 ₽)",
                            callback_data=f"buy_coins_pack:{user_id}:500:4500",
                        ),
                        InlineKeyboardButton(
                            text="2000 coins (150 ₽)",
                            callback_data=f"buy_coins_pack:{user_id}:2000:15000",
                        ),
                    )
                    await message.answer(
                        f"Аккаунт найден: {user.get('username') or email}\nВыберите пакет монет:",
                        reply_markup=builder.as_markup(),
                    )
                else:
                    await message.answer(
                        "Аккаунт не найден. Проверьте email или зарегистрируйтесь на сайте."
                    )
    except Exception as e:
        await message.answer(f"Ошибка проверки email: {str(e)}")
        return


@dp.callback_query(F.data == "restore")
async def restore_key(callback: types.CallbackQuery):
    user_id = str(callback.from_user.id)

    avatar_url = None
    try:
        user_profile_photos = await callback.bot.get_user_profile_photos(
            callback.from_user.id, limit=1
        )
        if user_profile_photos.total_count > 0:
            file_id = user_profile_photos.photos[0][-1].file_id
            file = await callback.bot.get_file(file_id)
            if file.file_path:
                avatar_url = (
                    f"https://api.telegram.org/file/bot{BOT_TOKEN}/{file.file_path}"
                )
    except Exception as e:
        logger.error(f"Не удалось получить аватарку: {e}")

    if not bcrypter.is_user_registered(user_id):
        await callback.message.answer(
            "⚠️ Вы еще не зарегистрированы. Нажмите 'Регистрация'."
        )
        await callback.answer()
        return
    key = bcrypter.rotate_key(user_id, avatar_url)
    if key:
        await callback.message.answer(
            f"🔄 Ваш ключ был обновлен!\n\n🔑 Новый секретный ключ:\n`{user_id}:{key}`\n\n⚠️ Старый ключ больше недействителен.",
            parse_mode="Markdown",
        )
    else:
        await callback.message.answer("❌ Произошла ошибка при обновлении ключа.")
    await callback.answer()


@dp.callback_query(F.data == "no_telegram")
async def no_telegram_auth(callback: types.CallbackQuery):
    builder = InlineKeyboardBuilder()
    builder.row(
        InlineKeyboardButton(text="📧 Почта + Пароль",
                             callback_data="auth_email")
    )
    builder.row(
        InlineKeyboardButton(text="🔴 Yandex Provider",
                             callback_data="auth_yandex")
    )

    await callback.message.answer(
        "Выберите способ авторизации:", reply_markup=builder.as_markup()
    )
    await callback.answer()


@dp.callback_query(F.data == "auth_yandex")
async def auth_yandex(callback: types.CallbackQuery):
    await callback.message.answer(
        "Для авторизации через Яндекс, пожалуйста, перейдите на наш сайт и войдите в свой аккаунт:\n\n"
        "🔗 [Перейти на сайт](http://localhost:3000/login)\n\n"
        "После авторизации вы сможете привязать свой Telegram аккаунт в настройках профиля.",
        parse_mode="Markdown",
        disable_web_page_preview=True,
    )
    await callback.answer()


@dp.callback_query(F.data == "link_yandex")
async def link_yandex_start(callback: types.CallbackQuery, state: FSMContext):
    await state.set_state(LinkStates.waiting_for_key)
    await callback.message.answer(
        "Введите код привязки, полученный на сайте в настройках профиля:"
    )
    await callback.answer()


@dp.message(LinkStates.waiting_for_key)
async def process_link_key(message: types.Message, state: FSMContext):
    key = message.text.strip()
    telegram_id = str(message.from_user.id)

    async with aiohttp.ClientSession() as session:
        try:
            async with session.post(
                f"{BACKEND_URL}/api/v1/auth/telegram/link",
                json={"link_key": key, "telegram_id": telegram_id},
            ) as response:
                if response.status == 200:
                    data = await response.json()
                    user = data.get("user")
                    username = user.get("username") if user else "Unknown"

                    builder = InlineKeyboardBuilder()
                    builder.add(
                        InlineKeyboardButton(
                            text="💎 Купить Vondic Premium",
                            callback_data=f"buy_premium:{user['id']}",
                        )
                    )

                    await message.answer(
                        f"✅ Аккаунт успешно привязан!\nТеперь вы можете использовать Premium функции.\nПользователь: {username}",
                        reply_markup=builder.as_markup(),
                    )
                    await state.clear()
                else:
                    error_data = await response.json()
                    error_msg = error_data.get("error", "Unknown error")
                    await message.answer(
                        f"❌ Ошибка привязки: {error_msg}\nПопробуйте еще раз."
                    )
        except Exception as e:
            await message.answer(f"❌ Ошибка соединения: {str(e)}")


@dp.callback_query(F.data == "auth_email")
async def auth_email_start(callback: types.CallbackQuery, state: FSMContext):
    await state.set_state(AuthStates.email)
    await callback.message.answer("📧 Введите ваш Email:")
    await callback.answer()


@dp.message(AuthStates.email)
async def auth_email_entered(message: types.Message, state: FSMContext):
    email = message.text.strip()
    await state.update_data(email=email)
    await state.set_state(AuthStates.password)
    await message.answer("🔑 Введите ваш пароль:")


@dp.message(AuthStates.password)
async def auth_password_entered(message: types.Message, state: FSMContext):
    password = message.text.strip()
    data = await state.get_data()
    email = data.get("email")

    user = bcrypter.authenticate_user(email, password)

    await state.clear()

    if user:
        builder = InlineKeyboardBuilder()
        builder.add(
            InlineKeyboardButton(
                text="Купить Vondic Premium",
                callback_data=f"buy_premium:{
                    user['id']}"))

        await message.answer(
            f"✅ Успешная авторизация!\nВы вошли как: {user['username']}",
            reply_markup=builder.as_markup(),
        )
    else:
        builder = InlineKeyboardBuilder()
        builder.add(
            InlineKeyboardButton(text="Попробовать снова",
                                 callback_data="auth_email")
        )
        await message.answer(
            "❌ Неверный email или пароль.", reply_markup=builder.as_markup()
        )


@dp.callback_query(F.data.startswith("buy_premium"))
async def buy_premium(callback: types.CallbackQuery):
    try:
        user_id = callback.data.split(":")[1]

        async with aiohttp.ClientSession() as session:
            async with session.post(
                f"{BACKEND_URL}/api/v1/payments/create-checkout-session",
                json={"user_id": user_id},
            ) as response:
                if response.status == 200:
                    data = await response.json()
                    payment_url = data.get("url")
                    if payment_url:
                        builder = InlineKeyboardBuilder()
                        builder.add(
                            InlineKeyboardButton(
                                text="💳 Перейти к оплате", url=payment_url
                            )
                        )
                        await callback.message.answer(
                            "Для оплаты Vondic Premium нажмите на кнопку ниже:",
                            reply_markup=builder.as_markup(),
                        )
                    else:
                        await callback.message.answer(
                            "❌ Ошибка получения ссылки на оплату."
                        )
                else:
                    error_text = await response.text()
                    logger.error(f"Backend error: {error_text}")
                    await callback.message.answer("❌ Ошибка сервиса оплаты.")

    except Exception as e:
        logger.error(f"Error buying premium: {e}")
        await callback.message.answer("❌ Произошла ошибка.")

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
