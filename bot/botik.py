"""Botik — system bot for creating and managing Vondic bots (like BotFather)."""
import asyncio
import logging
import os
import requests
import sys
import uuid

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
    ReplyKeyboardBuilder,
    ReplyKeyboardRemove,
    KeyboardButton,
    Text,
)

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(message)s")
logger = logging.getLogger(__name__)
load_dotenv(".env.botik")

BOT_ID = os.getenv("BOTIK_ID", "")
BOT_TOKEN = os.getenv("BOTIK_TOKEN", "")
BACKEND_URL = os.getenv("BACKEND_URL", "http://backend:5050")
FRONTEND_URL = os.getenv("FRONTEND_URL", "https://vondic.ru")

dp = Dispatcher()

# FSM states
STATE_WAITING_BOT_NAME = "waiting_bot_name"
STATE_WAITING_BOT_DESC = "waiting_bot_desc"


async def http_get(url, timeout=5, headers=None):
    return await asyncio.to_thread(requests.get, url, timeout=timeout, headers=headers or {})


async def http_post(url, json=None, timeout=10, headers=None):
    return await asyncio.to_thread(requests.post, url, json=json, timeout=timeout, headers=headers or {})


async def http_put(url, json=None, timeout=10, headers=None):
    return await asyncio.to_thread(requests.put, url, json=json, timeout=timeout, headers=headers or {})


async def http_delete(url, timeout=10, headers=None):
    return await asyncio.to_thread(requests.delete, url, timeout=timeout, headers=headers or {})


def _bot_headers():
    return {"Authorization": f"Bot {BOT_TOKEN}"}


@dp.startup
async def on_startup():
    logger.info("Botik started. Bot ID: %s, Backend: %s", BOT_ID, BACKEND_URL)


@dp.shutdown
async def on_shutdown():
    logger.info("Botik shutting down...")


@dp.errors()
async def on_error(update, bot, error):
    logger.error("Handler error: %s", error, exc_info=True)


# ── /start ─────────────────────────────────────────────────────

@dp.message(Command("start"))
async def cmd_start(message: Message, bot: Bot, state: FSMContext):
    await bot.send_message(
        str(message.chat.id),
        "🤖 **Добро пожаловать в Botik!**\n\n"
        "Я помогу вам создать и настроить бота для Вондик.\n\n"
        "📋 **Команды:**\n"
        "/newbot — Создать нового бота\n"
        "/mybots — Ваши боты\n"
        "/help — Справка",
    )


# ── /help ──────────────────────────────────────────────────────

@dp.message(Command("help"))
async def cmd_help(message: Message, bot: Bot):
    await bot.send_message(
        str(message.chat.id),
        "📋 **Команды Botik:**\n\n"
        "🆕 /newbot — Создать нового бота\n"
        "📋 /mybots — Список ваших ботов\n"
        "✏️ /setname `ID` `имя` — Изменить имя\n"
        "📝 /setdesc `ID` `описание` — Изменить описание\n"
        "🖼 /setavatar `ID` `URL` — Изменить аватарку\n"
        "🔐 /setscopes `ID` `scopes` — Установить разрешения\n"
        "🗑 /deletebot `ID` — Удалить бота\n\n"
        "После создания бота вы получите токен для подключения через BotikSDK.",
        reply_markup=ReplyKeyboardRemove().as_markup(),
    )


# ── /newbot ────────────────────────────────────────────────────

@dp.message(Command("newbot"))
async def cmd_newbot(message: Message, bot: Bot, state: FSMContext):
    await state.set_state(STATE_WAITING_BOT_NAME)
    await bot.send_message(
        str(message.chat.id),
        "🆕 **Создание нового бота**\n\n"
        "Введите имя для вашего бота (например: `Мой Бот`):",
        reply_markup=ReplyKeyboardRemove().as_markup(),
    )


@dp.message(state=STATE_WAITING_BOT_NAME)
async def process_bot_name(message: Message, bot: Bot, state: FSMContext):
    name = (message.text or "").strip()
    if not name or len(name) < 2:
        await bot.send_message(str(message.chat.id), "❌ Имя слишком короткое. Попробуйте ещё раз:")
        return

    await state.set_state(STATE_WAITING_BOT_DESC)
    await state.update_data(bot_name=name)
    await bot.send_message(
        str(message.chat.id),
        f"✅ Имя: **{name}**\n\n"
        "Теперь введите описание бота (или отправьте `-` чтобы пропустить):",
    )


@dp.message(state=STATE_WAITING_BOT_DESC)
async def process_bot_desc(message: Message, bot: Bot, state: FSMContext):
    desc = (message.text or "").strip()
    if desc == "-":
        desc = ""

    data = await state.get_data()
    name = data.get("bot_name", "Бот")
    await state.clear()

    user_id = str(message.from_user.id)
    chat_id = str(message.chat.id)

    try:
        resp = await http_post(
            f"{BACKEND_URL}/api/v1/bots",
            json={"name": name, "description": desc},
            headers=_bot_headers(),
        )
        if resp.status_code == 201:
            data = resp.json()
            bot_id = data.get("id")
            # Generate token for the new bot
            token_resp = await http_post(
                f"{BACKEND_URL}/api/v1/bots/{bot_id}/generate-token",
                json={},
                headers=_bot_headers(),
            )
            token = None
            if token_resp.status_code == 200:
                token = token_resp.json().get("token")

            msg = (
                f"🎉 **Бот создан!**\n\n"
                f"📛 Имя: **{name}**\n"
                f"🆔 ID: `{bot_id}`\n"
            )
            if token:
                msg += f"🔑 Токен: `{token}`\n"
            msg += (
                f"\n📖 **Подключение через BotikSDK:**\n"
                f"```python\nfrom botiksdk import Bot, Dispatcher\n\n"
                f"bot = Bot(bot_id='{bot_id}', token='{token}', base_url='http://backend:5050')\n"
                f"dp = Dispatcher()\n\n"
                f"@dp.message()\n"
                f"async def echo(message, bot):\n"
                f"    await bot.send_message(str(message.chat.id), message.text)\n```\n"
                f"\n⚠️ **Сохраните токен!** Он показывается только один раз."
            )
            await bot.send_message(chat_id, msg)
        else:
            err = resp.json().get("detail", "Неизвестная ошибка")
            await bot.send_message(chat_id, f"❌ Ошибка создания бота: {err}")
    except Exception as e:
        logger.error("newbot error: %s", e)
        await bot.send_message(chat_id, "❌ Ошибка сервера. Попробуйте позже.")


# ── /mybots ────────────────────────────────────────────────────

@dp.message(Command("mybots"))
async def cmd_mybots(message: Message, bot: Bot):
    chat_id = str(message.chat.id)
    user_id = str(message.from_user.id)

    try:
        resp = await http_get(f"{BACKEND_URL}/api/v1/bots", headers=_bot_headers())
        if resp.status_code == 200:
            data = resp.json()
            bots = data if isinstance(data, list) else (data.get("bots") or data.get("items") or [])
            if not bots:
                await bot.send_message(chat_id, "📋 У вас пока нет ботов. Используйте /newbot для создания.", reply_markup=ReplyKeyboardRemove().as_markup())
                return

            lines = ["📋 **Ваши боты:**\n"]
            for b in bots:
                name = b.get("name", "Бот")
                bid = b.get("id", "?")
                verified = " ✅" if b.get("is_verified") else ""
                lines.append(f"• **{name}**{verified}\n  `{bid}`")

            await bot.send_message(chat_id, "\n".join(lines), reply_markup=ReplyKeyboardRemove().as_markup())
        else:
            await bot.send_message(chat_id, "❌ Не удалось загрузить список ботов.", reply_markup=ReplyKeyboardRemove().as_markup())
    except Exception as e:
        logger.error("mybots error: %s", e)
        await bot.send_message(chat_id, "❌ Ошибка сервера.")


# ── /setname ───────────────────────────────────────────────────

@dp.message(Command("setname"))
async def cmd_setname(message: Message, bot: Bot):
    chat_id = str(message.chat.id)
    parts = (message.text or "").split(maxsplit=2)
    if len(parts) < 3:
        await bot.send_message(chat_id, "✏️ Использование: `/setname ID новое_имя`")
        return

    bot_id, new_name = parts[1], parts[2]
    try:
        resp = await http_post(
            f"{BACKEND_URL}/api/public/v1/bots/{bot_id}/update",
            json={"name": new_name},
            headers=_bot_headers(),
        )
        if resp.status_code == 200:
            await bot.send_message(chat_id, f"✅ Имя бота изменено на **{new_name}**")
        else:
            err = resp.json().get("detail", "Ошибка")
            await bot.send_message(chat_id, f"❌ {err}")
    except Exception as e:
        logger.error("setname error: %s", e)
        await bot.send_message(chat_id, "❌ Ошибка сервера.")


# ── /setdesc ───────────────────────────────────────────────────

@dp.message(Command("setdesc"))
async def cmd_setdesc(message: Message, bot: Bot):
    chat_id = str(message.chat.id)
    parts = (message.text or "").split(maxsplit=2)
    if len(parts) < 3:
        await bot.send_message(chat_id, "📝 Использование: `/setdesc ID описание`")
        return

    bot_id, desc = parts[1], parts[2]
    try:
        resp = await http_post(
            f"{BACKEND_URL}/api/public/v1/bots/{bot_id}/update",
            json={"description": desc},
            headers=_bot_headers(),
        )
        if resp.status_code == 200:
            await bot.send_message(chat_id, f"✅ Описание обновлено.")
        else:
            err = resp.json().get("detail", "Ошибка")
            await bot.send_message(chat_id, f"❌ {err}")
    except Exception as e:
        logger.error("setdesc error: %s", e)
        await bot.send_message(chat_id, "❌ Ошибка сервера.")


# ── /setavatar ─────────────────────────────────────────────────

@dp.message(Command("setavatar"))
async def cmd_setavatar(message: Message, bot: Bot):
    chat_id = str(message.chat.id)
    parts = (message.text or "").split(maxsplit=2)
    if len(parts) < 3:
        await bot.send_message(chat_id, "🖼 Использование: `/setavatar ID URL_картинки`")
        return

    bot_id, avatar_url = parts[1], parts[2]
    try:
        resp = await http_post(
            f"{BACKEND_URL}/api/public/v1/bots/{bot_id}/update",
            json={"avatar_url": avatar_url},
            headers=_bot_headers(),
        )
        if resp.status_code == 200:
            await bot.send_message(chat_id, f"✅ Аватарка обновлена.")
        else:
            err = resp.json().get("detail", "Ошибка")
            await bot.send_message(chat_id, f"❌ {err}")
    except Exception as e:
        logger.error("setavatar error: %s", e)
        await bot.send_message(chat_id, "❌ Ошибка сервера.")


# ── /setweb — set bot website URL ──────────────────────────────

@dp.message(Command("setweb"))
async def cmd_setweb(message: Message, bot: Bot):
    chat_id = str(message.chat.id)
    parts = (message.text or "").split(maxsplit=2)
    if len(parts) < 3:
        await bot.send_message(chat_id, "🌐 Использование: `/setweb ID https://example.com`\n\nСайт должен иметь SSL-сертификат (https).")
        return

    bot_id, web_url = parts[1], parts[2]
    if not web_url.startswith("https://"):
        await bot.send_message(chat_id, "❌ URL должен начинаться с `https://` (требуется SSL).")
        return

    try:
        resp = await http_post(
            f"{BACKEND_URL}/api/public/v1/bots/{bot_id}/update",
            json={"description": web_url},  # Store website in description for now
            headers=_bot_headers(),
        )
        if resp.status_code == 200:
            await bot.send_message(chat_id, f"✅ Сайт бота установлен: {web_url}")
        else:
            err = resp.json().get("detail", "Ошибка")
            await bot.send_message(chat_id, f"❌ {err}")
    except Exception as e:
        logger.error("setweb error: %s", e)
        await bot.send_message(chat_id, "❌ Ошибка сервера.")


# ── /setscopes — set required permission scopes ───────────────

@dp.message(Command("setscopes"))
async def cmd_setscopes(message: Message, bot: Bot):
    chat_id = str(message.chat.id)
    parts = (message.text or "").split(maxsplit=2)
    if len(parts) < 3:
        await bot.send_message(
            chat_id,
            "🔐 Использование: `/setscopes ID scope1,scope2,...`\n\n"
            "Доступные скоупы:\n"
            "• `username` — имя пользователя\n"
            "• `full_name` — полное имя\n"
            "• `email` — почта\n"
            "• `avatar` — аватар\n"
            "• `balance` — баланс\n"
            "• `send_messages` — отправка сообщений\n"
            "• `all` — полный доступ\n\n"
            "Пример: `/setscopes ID username,send_messages`",
        )
        return

    bot_id, scopes_str = parts[1], parts[2]
    scopes = [s.strip() for s in scopes_str.split(",") if s.strip()]
    try:
        resp = await http_post(
            f"{BACKEND_URL}/api/public/v1/bots/{bot_id}/update",
            json={"required_scopes": scopes},
            headers=_bot_headers(),
        )
        if resp.status_code == 200:
            await bot.send_message(chat_id, f"✅ Скоупы обновлены: `{', '.join(scopes)}`")
        else:
            err = resp.json().get("detail", "Ошибка")
            await bot.send_message(chat_id, f"❌ {err}")
    except Exception as e:
        logger.error("setscopes error: %s", e)
        await bot.send_message(chat_id, "❌ Ошибка сервера.")


# ── /deletebot ─────────────────────────────────────────────────

@dp.message(Command("deletebot"))
async def cmd_deletebot(message: Message, bot: Bot):
    chat_id = str(message.chat.id)
    parts = (message.text or "").split(maxsplit=1)
    if len(parts) < 2:
        await bot.send_message(chat_id, "🗑 Использование: `/deletebot ID`")
        return

    bot_id = parts[1]
    kb = InlineKeyboardBuilder()
    kb.row(
        InlineKeyboardButton("✅ Да, удалить", callback_data=f"confirm_delete:{bot_id}"),
        InlineKeyboardButton("❌ Отмена", callback_data="cancel_delete"),
    )
    await bot.send_message(
        chat_id,
        f"⚠️ Вы уверены, что хотите удалить бота `{bot_id}`?\n\n"
        "Это действие необратимо.",
        reply_markup=kb.as_markup(),
    )


@dp.callback_query(lambda c: c.data and c.data.startswith("confirm_delete:"))
async def confirm_delete(callback: CallbackQuery, bot: Bot):
    bot_id = callback.data.split(":", 1)[1]
    chat_id = str(callback.message.chat.id)
    try:
        resp = await http_delete(
            f"{BACKEND_URL}/api/v1/bots/{bot_id}",
            headers=_bot_headers(),
        )
        if resp.status_code == 200:
            await bot.send_message(chat_id, f"🗑 Бот `{bot_id}` удалён.")
        else:
            await bot.send_message(chat_id, "❌ Не удалось удалить бота.")
    except Exception as e:
        logger.error("delete error: %s", e)
        await bot.send_message(chat_id, "❌ Ошибка сервера.")
    try:
        await bot.answer_callback_query(callback.id)
    except Exception:
        pass


@dp.callback_query(lambda c: c.data == "cancel_delete")
async def cancel_delete(callback: CallbackQuery, bot: Bot):
    await bot.send_message(str(callback.message.chat.id), "❌ Удаление отменено.")
    try:
        await bot.answer_callback_query(callback.id)
    except Exception:
        pass


# ── /kb — keyboard menu ───────────────────────────────────────

@dp.message(Command("kb"))
async def cmd_kb(message: Message, bot: Bot):
    kb = ReplyKeyboardBuilder()
    kb.row(
        KeyboardButton("🆕 Создать бота", css_class="rk-btn rk-green"),
        KeyboardButton("📋 Мои боты", css_class="rk-btn rk-blue"),
    )
    kb.row(KeyboardButton("❓ Справка", css_class="rk-btn rk-gray"))
    await bot.send_message(str(message.chat.id), "📋 **Меню Botik:**", reply_markup=kb.as_markup())


# ── Reply keyboard button handlers ─────────────────────────────

@dp.message(Text("🆕 Создать бота"))
async def btn_newbot(message: Message, bot: Bot, state: FSMContext):
    await cmd_newbot(message, bot, state)


@dp.message(Text("📋 Мои боты"))
async def btn_mybots(message: Message, bot: Bot):
    await cmd_mybots(message, bot)


@dp.message(Text("❓ Справка"))
async def btn_help(message: Message, bot: Bot):
    await cmd_help(message, bot)


# ── Catch-all for unknown commands ─────────────────────────────

@dp.message()
async def catch_all(message: Message, bot: Bot):
    text = (message.text or "").strip()
    if text.startswith("/"):
        await bot.send_message(
            str(message.chat.id),
            f"❓ Неизвестная команда: `{text}`\n\nОтправьте /help для списка команд.",
        )


# ── Run ────────────────────────────────────────────────────────

async def main():
    if not BOT_TOKEN:
        logger.error("BOTIK_TOKEN не установлен.")
        return
    bot = Bot(bot_id=BOT_ID, token=BOT_TOKEN, base_url=BACKEND_URL)
    await dp.start_polling(bot)


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        pass
