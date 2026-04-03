from typing import Optional
import asyncio
import logging
import os
import sys

from dotenv import load_dotenv

from botiksdk import (
    Bot,
    CallbackQuery,
    Command,
    Dispatcher,
    FSMContext,
    InlineKeyboardBuilder,
    InlineKeyboardButton,
    Message,
)

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from bcrypter.service import BCrypter

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)
load_dotenv(".env.bot")

BOT_ID = os.getenv("BOT_ID", "9b0325e4-13fc-4659-8b86-88b90a4bfdb5")
BOT_TOKEN = os.getenv("BOT_TOKEN", "DbTXn0tna4VkF2XtiCI_bXa7TehYqxDIPfHKsjbfGKg")
BACKEND_URL = os.getenv("BACKEND_URL", "https://api.vondic.knopusmedia.ru")

dp = Dispatcher()
bcrypter = BCrypter()


class AuthStates:
    email = "auth_email"
    password = "auth_password"


class CoinsStates:
    email = "coins_email"


class LinkStates:
    waiting_for_key = "link_waiting"


async def get_user_profile_photos_mock(bot, user_id: str, limit: int = 1):
    return {"total_count": 0, "photos": []}


async def get_file_mock(bot, file_id: str):
    return {"file_id": file_id, "file_path": ""}
@dp.message(Command("start"))
async def cmd_start(message: Message, bot: Bot, state: FSMContext):
    builder = InlineKeyboardBuilder()

    builder.row(InlineKeyboardButton(text="✅ Регистрация", callback_data="register"))
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
        InlineKeyboardButton(text="💰 Купить Vondic Coins", callback_data="buy_coins")
    )

    safe_send_message(
        bot,
        str(message.chat.id),
        "👋 Добро пожаловать в Vondic Bot!\n\nВыберите действие:",
        reply_markup=builder.as_markup(),
    )


async def safe_answer_callback_query(bot: Bot, callback_id: str, text: Optional[str] = None, show_alert: bool = False):
    try:
        import inspect

        res = bot.answer_callback_query(callback_id, text=text, show_alert=show_alert)
        if inspect.iscoroutine(res):
            await res
    except Exception as e:
        logger.error(f"Failed to answer callback query {callback_id}: {e}")


def safe_send_message(bot: Bot, chat_id: str, text: str, **kwargs):
    """Safely send a message, catching any exceptions to prevent 500 errors"""
    try:
        return bot.send_message(chat_id, text, **kwargs)
    except Exception as e:
        logger.error(f"Failed to send message to {chat_id}: {e}")
        return None


@dp.callback_query(lambda c: c.data == "buy_premium_tg")
async def buy_premium_tg_start(callback: CallbackQuery, bot: Bot, state: FSMContext):
    user_id = str(callback.from_user.id)
    linked_user = None

    try:
        import requests

        response = requests.get(
            f"{BACKEND_URL}/api/v1/users/by-telegram/{user_id}", timeout=5
        )
        if response.status_code == 200:
            linked_user = response.json()
    except Exception as e:
        logger.error(f"Error checking linked user: {e}")

    is_local_registered = bcrypter.is_user_registered(user_id)

    if not linked_user and not is_local_registered:
        builder = InlineKeyboardBuilder()
        builder.add(
            InlineKeyboardButton(text="✅ Зарегистрироваться", callback_data="register")
        )
        safe_send_message(
            bot,
            str(callback.message.chat.id),
            "⚠️ Вы не зарегистрированы в системе.\nСначала пройдите регистрацию или привяжите существующий аккаунт, чтобы купить Premium.",
            reply_markup=builder.as_markup(),
        )
        await safe_answer_callback_query(bot, callback.id)
        return

    target_user_id = linked_user["id"] if linked_user else user_id

    builder = InlineKeyboardBuilder()
    builder.add(
        InlineKeyboardButton(
            text="💳 Оплатить Premium",
            callback_data=f"buy_premium:{target_user_id}",
        )
    )

    safe_send_message(
        bot,
        str(callback.message.chat.id),
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
    await safe_answer_callback_query(bot, callback.id)


@dp.callback_query(lambda c: c.data == "buy_coins")
async def buy_coins_menu(callback: CallbackQuery, bot: Bot, state: FSMContext):
    builder = InlineKeyboardBuilder()
    builder.row(
        InlineKeyboardButton(
            text="Для Telegram аккаунта", callback_data="buy_coins_tg"
        )
    )
    builder.row(
        InlineKeyboardButton(
            text="Для Yandex/Email аккаунта", callback_data="buy_coins_email"
        )
    )
    safe_send_message(
        bot,
        str(callback.message.chat.id),
        "Выберите, для какого аккаунта купить Vondic Coins:",
        reply_markup=builder.as_markup(),
    )
    await safe_answer_callback_query(bot, callback.id)


@dp.callback_query(lambda c: c.data == "buy_coins_tg")
async def buy_coins_tg(callback: CallbackQuery, bot: Bot, state: FSMContext):
    user_id = str(callback.from_user.id)
    linked_user = None
    try:
        import requests

        response = requests.get(
            f"{BACKEND_URL}/api/v1/users/by-telegram/{user_id}", timeout=5
        )
        if response.status_code == 200:
            linked_user = response.json()
    except Exception as e:
        logger.error(f"Error checking linked user: {e}")

    if not linked_user:
        builder = InlineKeyboardBuilder()
        builder.add(
            InlineKeyboardButton(
                text="🔗 Привязать аккаунт (Yandex)", callback_data="link_yandex"
            )
        )
        builder.add(
            InlineKeyboardButton(text="✅ Регистрация", callback_data="register")
        )
        safe_send_message(
            bot,
            str(callback.message.chat.id),
            "Сначала привяжите или зарегистрируйте аккаунт, чтобы купить Vondic Coins.",
            reply_markup=builder.as_markup(),
        )
        await safe_answer_callback_query(bot, callback.id)
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
    safe_send_message(
        bot,
        str(callback.message.chat.id),
        "Выберите пакет Vondic Coins:",
        reply_markup=builder.as_markup(),
    )
    await safe_answer_callback_query(bot, callback.id)


@dp.callback_query(lambda c: c.data == "buy_coins_email")
async def buy_coins_email_start(
    callback: CallbackQuery, bot: Bot, state: FSMContext
):
    await state.set_state(CoinsStates.email)
    safe_send_message(
        bot,
        str(callback.message.chat.id),
        "📧 Введите email аккаунта Vondic/Yandex для покупки монет:",
    )
    await safe_answer_callback_query(bot, callback.id)


@dp.callback_query(lambda c: c.data.startswith("buy_coins_pack"))
async def buy_coins_pack(callback: CallbackQuery, bot: Bot, state: FSMContext):
    try:
        _, user_id, coins, amount = callback.data.split(":")
        import requests

        response = requests.post(
            f"{BACKEND_URL}/api/v1/payments/create-coins-session",
            json={
                "buyer_id": user_id,
                "coins": int(coins),
                "currency": "rub",
                "success_url": "http://localhost:3000/shop/success",
                "cancel_url": "http://localhost:3000/shop/cancel",
            },
            timeout=10,
        )
        if response.status_code == 200:
            data = response.json()
            url = data.get("url")
            if url:
                builder = InlineKeyboardBuilder()
                builder.add(
                    InlineKeyboardButton(text="💳 Оплатить", url=url)
                )
                safe_send_message(
                    bot,
                    str(callback.message.chat.id),
                    "Перейдите к оплате:",
                    reply_markup=builder.as_markup(),
                )
            else:
                safe_send_message(
                    bot,
                    str(callback.message.chat.id),
                    "Ошибка получения ссылки."
                )
        else:
            safe_send_message(
                bot,
                str(callback.message.chat.id),
                "Ошибка сервиса оплаты."
            )
    except Exception as e:
        logger.error(f"buy_coins_pack error: {e}")
        safe_send_message(bot, str(callback.message.chat.id), "Произошла ошибка.")
    await safe_answer_callback_query(bot, callback.id)


@dp.message(lambda m: m.text is not None, state=CoinsStates.email)
async def buy_coins_email_entered(
    message: Message, bot: Bot, state: FSMContext
):
    email = message.text.strip()
    await state.clear()
    try:
        import requests

        response = requests.get(
            f"{BACKEND_URL}/api/v1/users/by-email/{email}", timeout=5
        )
        if response.status_code == 200:
            user = response.json()
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
            safe_send_message(
                bot,
                str(message.chat.id),
                f"Аккаунт найден: {user.get('username') or email}\nВыберите пакет монет:",
                reply_markup=builder.as_markup(),
            )
        else:
            safe_send_message(
                bot,
                str(message.chat.id),
                "Аккаунт не найден. Проверьте email или зарегистрируйтесь на сайте.",
            )
    except Exception as e:
        logger.error(f"buy_coins_email_entered error: {e}")
        safe_send_message(bot, str(message.chat.id), f"Ошибка проверки email: {str(e)}")


@dp.callback_query(lambda c: c.data == "register")
async def register_user(callback: CallbackQuery, bot: Bot, state: FSMContext):
    user_id = str(callback.from_user.id)
    username = callback.from_user.username or f"user_{user_id}"

    avatar_url = None
    try:
        pass
    except Exception as e:
        logger.error(f"Не удалось получить аватарку: {e}")

    if bcrypter.is_user_registered(user_id):
        safe_send_message(
            bot,
            str(callback.message.chat.id),
            "Вы уже зарегистрированы. Используйте 'Войти / Восстановить ключ', если забыли ключ.",
        )
        await safe_answer_callback_query(bot, callback.id)
        return

    key = bcrypter.register_user(user_id, username, avatar_url)
    if key:
        safe_send_message(
            bot,
            str(callback.message.chat.id),
            f"✅ Вы успешно зарегистрированы!\n\n🔑 Ваш секретный ключ:\n`{user_id}:{key}`\n\n⚠️ Сохраните его, он показывается только один раз!\nИспользуйте этот ключ для авторизации на сайте.",
            parse_mode="Markdown",
        )
    else:
        safe_send_message(
            bot,
            str(callback.message.chat.id),
            "❌ Произошла ошибка при регистрации. Возможно, такое имя пользователя уже занято.",
        )
    await safe_answer_callback_query(bot, callback.id)


@dp.callback_query(lambda c: c.data == "restore")
async def restore_key(callback: CallbackQuery, bot: Bot, state: FSMContext):
    user_id = str(callback.from_user.id)

    avatar_url = None


    if not bcrypter.is_user_registered(user_id):
        safe_send_message(
            bot,
            str(callback.message.chat.id),
            "⚠️ Вы еще не зарегистрированы. Нажмите 'Регистрация'.",
        )
        await safe_answer_callback_query(bot, callback.id)
        return

    key = bcrypter.rotate_key(user_id, avatar_url)
    if key:
        safe_send_message(
            bot,
            str(callback.message.chat.id),
            f"🔄 Ваш ключ был обновлен!\n\n🔑 Новый секретный ключ:\n`{user_id}:{key}`\n\n⚠️ Старый ключ больше недействителен.",
            parse_mode="Markdown",
        )
    else:
        safe_send_message(
            bot,
            str(callback.message.chat.id),
            "❌ Произошла ошибка при обновлении ключа."
        )
    await safe_answer_callback_query(bot, callback.id)

@dp.callback_query(lambda c: c.data == "auth_email")
async def auth_email_start(callback: CallbackQuery, bot: Bot, state: FSMContext):
    await state.set_state(AuthStates.email)
    safe_send_message(
        bot,
        str(callback.message.chat.id),
        "📧 Введите ваш email:",
    )
    await safe_answer_callback_query(bot, callback.id)


@dp.message(lambda m: m.text is not None, state=AuthStates.email)
async def auth_email_entered(message: Message, bot: Bot, state: FSMContext):
    email = message.text.strip()
    await state.update_data(email=email)
    await state.set_state(AuthStates.password)
    safe_send_message(bot, str(message.chat.id), "🔑 Введите ваш пароль:")


@dp.message(lambda m: m.text is not None, state=AuthStates.password)
async def auth_password_entered(message: Message, bot: Bot, state: FSMContext):
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
                callback_data=f"buy_premium:{user['id']}",
            )
        )

        safe_send_message(
            bot,
            str(message.chat.id),
            f"✅ Успешная авторизация!\nВы вошли как: {user['username']}",
            reply_markup=builder.as_markup(),
        )
    else:
        builder = InlineKeyboardBuilder()
        builder.add(
            InlineKeyboardButton(text="Попробовать снова", callback_data="auth_email")
        )
        safe_send_message(
            bot,
            str(message.chat.id),
            "❌ Неверный email или пароль.",
            reply_markup=builder.as_markup(),
        )


@dp.callback_query(lambda c: c.data.startswith("buy_premium"))
async def buy_premium(callback: CallbackQuery, bot: Bot, state: FSMContext):
    try:
        user_id = callback.data.split(":")[1]

        import requests

        response = requests.post(
            f"{BACKEND_URL}/api/v1/payments/create-checkout-session",
            json={"user_id": user_id},
            timeout=10,
        )
        if response.status_code == 200:
            data = response.json()
            payment_url = data.get("url")
            if payment_url:
                builder = InlineKeyboardBuilder()
                builder.add(
                    InlineKeyboardButton(
                        text="💳 Перейти к оплате", url=payment_url
                    )
                )
                safe_send_message(
                    bot,
                    str(callback.message.chat.id),
                    "Для оплаты Vondic Premium нажмите на кнопку ниже:",
                    reply_markup=builder.as_markup(),
                )
            else:
                safe_send_message(
                    bot,
                    str(callback.message.chat.id),
                    "❌ Ошибка получения ссылки на оплату.",
                )
        else:
            error_text = response.text
            logger.error(f"Backend error: {error_text}")
            safe_send_message(
                bot,
                str(callback.message.chat.id),
                "❌ Ошибка сервиса оплаты."
            )

    except Exception as e:
        logger.error(f"Error buying premium: {e}")
        safe_send_message(bot, str(callback.message.chat.id), "❌ Произошла ошибка.")

    await safe_answer_callback_query(bot, callback.id)


async def main():
    if not BOT_TOKEN:
        logger.error(
            "BOT_TOKEN не установлен. Пожалуйста, укажите его в переменных окружения или файле .env."
        )
        return


    bot = Bot(
        bot_id=BOT_ID,
        token=BOT_TOKEN,
        base_url=BACKEND_URL
    )
    logger.info("Запуск бота на botiksdk...")
    logger.info(f"Bot ID: {BOT_ID}")
    logger.info(f"Backend URL: {BACKEND_URL}")
    await dp.start_polling(bot)


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        pass
