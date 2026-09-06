"""Vondic Bot — BotikSDK v0.4.0 with consent permissions."""
from typing import Optional
import asyncio
import logging
import os
import sys
import requests

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
    game_play_button,
    play_games_button,
    upload_game_button,
    RequireScopes,
)

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(message)s")
logger = logging.getLogger(__name__)
load_dotenv(".env.bot")

BOT_ID = os.getenv("BOT_ID", "")
BOT_TOKEN = os.getenv("BOT_TOKEN", "")
BACKEND_URL = os.getenv("BACKEND_URL", "http://backend:5050")
FRONTEND_URL = os.getenv("FRONTEND_URL", "https://vondic.ru")

dp = Dispatcher()


# ── HTTP helpers ──────────────────────────────────────────────

async def http_get(url: str, timeout: int = 5, headers: dict = None):
    return await asyncio.to_thread(requests.get, url, timeout=timeout, headers=headers or {})


async def http_post(url: str, json: dict = None, timeout: int = 10, headers: dict = None):
    return await asyncio.to_thread(requests.post, url, json=json, timeout=timeout, headers=headers or {})


def _bot_headers():
    """Headers for bot-authenticated requests to backend."""
    return {"Authorization": f"Bot {BOT_TOKEN}"}


async def safe_answer(bot: Bot, callback_id: str, text: Optional[str] = None, show_alert: bool = False):
    try:
        await bot.answer_callback_query(callback_id, text=text, show_alert=show_alert)
    except Exception:
        pass


# ── Consent middleware — auto-checks permissions ───────────────

async def _check_user_consent(message: Message, bot: Bot) -> bool:
    """Check if user has granted permissions. If not, send consent request with scope details."""
    user_id = str(message.from_user.id)
    chat_id = str(message.chat.id)
    try:
        resp = await http_get(
            f"{BACKEND_URL}/api/public/v1/bots/{BOT_ID}/permissions/{user_id}",
            timeout=3,
            headers=_bot_headers(),
        )
        if resp.status_code == 200:
            data = resp.json()
            if data.get("granted"):
                return True
            # Not granted — show detailed consent request
            required = data.get("required_scopes", [])
            descriptions = data.get("scope_descriptions", {})
            scope_lines = []
            for s in required:
                desc = descriptions.get(s, s)
                scope_lines.append(f"  • **{desc}** (`{s}`)")
            scopes_text = "\n".join(scope_lines) if scope_lines else "  • Базовые данные"

            kb = InlineKeyboardBuilder()
            kb.row(InlineKeyboardButton("✅ Разрешить доступ", callback_data=f"consent_grant:{user_id}"))
            await bot.send_message(
                chat_id,
                "🔐 **Запрос разрешений**\n\n"
                f"Бот **{BOT_ID[:8]}...** запрашивает доступ к:\n\n"
                f"{scopes_text}\n\n"
                "Нажмите кнопку ниже, чтобы предоставить доступ:",
                reply_markup=kb.as_markup(),
            )
            return False
    except Exception:
        pass

    # Fallback if API unavailable
    kb = InlineKeyboardBuilder()
    kb.row(InlineKeyboardButton("🔐 Разрешить доступ", callback_data=f"consent_grant:{user_id}"))
    await bot.send_message(
        chat_id,
        "🔐 **Запрос разрешений**\n\n"
        "Чтобы использовать функции бота, необходимо разрешить доступ.\n\n"
        "Нажмите кнопку ниже для подтверждения:",
        reply_markup=kb.as_markup(),
    )
    return False


# ── Startup / Shutdown ────────────────────────────────────────

@dp.startup
async def on_startup():
    logger.info("Bot started. Bot ID: %s, Backend: %s, Frontend: %s", BOT_ID, BACKEND_URL, FRONTEND_URL)


@dp.shutdown
async def on_shutdown():
    logger.info("Bot shutting down...")


# ── Error handler ─────────────────────────────────────────────

@dp.errors()
async def on_error(update, bot, error):
    logger.error("Handler error: %s", error, exc_info=True)
    try:
        if hasattr(update, "message") and update.message:
            await bot.send_message(str(update.message.chat.id), "⚠️ Произошла ошибка. Попробуйте позже.")
    except Exception:
        pass


# ── /start — always allowed, no consent check ─────────────────

@dp.message(Command("start"))
async def cmd_start(message: Message, bot: Bot, state: FSMContext):
    kb = ReplyKeyboardBuilder()
    kb.row(
        KeyboardButton("🎮 Игры", css_class="rk-btn rk-purple"),
        KeyboardButton("💰 Пополнить", css_class="rk-btn rk-green"),
    )
    kb.row(KeyboardButton("ℹ️ Помощь", css_class="rk-btn rk-gray"))

    await bot.send_message(
        str(message.chat.id),
        "👋 Добро пожаловать в Вондик!\n\n"
        "🎮 Игры — HTML/CSS/JS в ZIP\n"
        "💰 Пополнить — пополнение через бота",
        reply_markup=kb.as_markup(),
    )


# ── /kb ───────────────────────────────────────────────────────

@dp.message(Command("kb"))
async def cmd_kb(message: Message, bot: Bot):
    kb = ReplyKeyboardBuilder()
    kb.row(
        KeyboardButton("🎮 Игры", css_class="rk-btn rk-purple"),
        KeyboardButton("💰 Пополнить", css_class="rk-btn rk-green"),
    )
    kb.row(KeyboardButton("ℹ️ Помощь", css_class="rk-btn rk-gray"))
    await bot.send_message(str(message.chat.id), "📋 Меню:", reply_markup=kb.as_markup())


# ── All other commands require consent ────────────────────────

@dp.message(Command("help"))
async def cmd_help(message: Message, bot: Bot):
    if not await _check_user_consent(message, bot):
        return
    kb = ReplyKeyboardBuilder()
    kb.row(
        KeyboardButton("🎮 Игры", css_class="rk-btn rk-purple"),
        KeyboardButton("💰 Пополнить", css_class="rk-btn rk-green"),
    )
    kb.row(KeyboardButton("ℹ️ Помощь", css_class="rk-btn rk-gray"))
    await bot.send_message(
        str(message.chat.id),
        "ℹ️ Помощь:\n\n"
        "/start — Начать\n"
        "/kb — Меню\n"
        "/help — Справка\n\n"
        "🎮 Игры — играйте в HTML/CSS/JS игры\n"
        "💰 Пополнить баланс — пополнение счёта",
        reply_markup=kb.as_markup(),
    )


# ── Reply keyboard handlers (all require consent) ─────────────

@dp.message(Text("🎮 Игры"))
async def menu_games(message: Message, bot: Bot):
    if not await _check_user_consent(message, bot):
        return
    builder = InlineKeyboardBuilder()
    builder.row(InlineKeyboardButton("📋 Список игр", callback_data="games:list"), play_games_button("🔄 Обновить"))
    await bot.send_message(str(message.chat.id), "🎮 Выберите действие:", reply_markup=builder.as_markup())


@dp.message(Text("💰 Пополнить"))
async def menu_balance(message: Message, bot: Bot):
    if not await _check_user_consent(message, bot):
        return
    user_id = str(message.from_user.id)
    try:
        resp = await http_post(f"{BACKEND_URL}/api/v1/users/get", json={"user_id": user_id})
        if resp.status_code == 200:
            user = resp.json()
            bal = user.get("balance", 0)
            bonus = user.get("bonus_balance", 0)
            builder = InlineKeyboardBuilder()
            builder.row(InlineKeyboardButton(text="💳 Пополнить баланс", callback_data="topup"))
            await bot.send_message(
                str(message.chat.id),
                f"💰 Баланс: {bal}₽\n🎁 Бонус: {bonus}₽\n\nИтого: {bal + bonus}₽",
                reply_markup=builder.as_markup(),
            )
        else:
            await bot.send_message(str(message.chat.id), "⚠️ Сначала зарегистрируйтесь.")
    except Exception:
        await bot.send_message(str(message.chat.id), "❌ Ошибка")


@dp.message(Text("ℹ️ Помощь"))
async def menu_help(message: Message, bot: Bot):
    if not await _check_user_consent(message, bot):
        return
    kb = ReplyKeyboardBuilder()
    kb.row(
        KeyboardButton("🎮 Игры", css_class="rk-btn rk-purple"),
        KeyboardButton("💰 Пополнить", css_class="rk-btn rk-green"),
    )
    kb.row(KeyboardButton("ℹ️ Помощь", css_class="rk-btn rk-gray"))
    await bot.send_message(
        str(message.chat.id),
        "ℹ️ Помощь:\n\n"
        "🎮 Игры — играйте в HTML/CSS/JS игры\n"
        "💰 Пополнить баланс — пополнение счёта",
        reply_markup=kb.as_markup(),
    )


# ── Consent callback ──────────────────────────────────────────

@dp.callback_query(lambda c: c.data and c.data.startswith("consent_grant:"))
async def consent_grant(callback: CallbackQuery, bot: Bot):
    user_id = callback.data.split(":", 1)[1]
    chat_id = str(callback.message.chat.id)

    # Get bot's required scopes
    required_scopes = ["username", "send_messages"]
    try:
        perms_resp = await http_get(
            f"{BACKEND_URL}/api/public/v1/bots/{BOT_ID}/permissions/{user_id}",
            timeout=3,
            headers=_bot_headers(),
        )
        if perms_resp.status_code == 200:
            required_scopes = perms_resp.json().get("required_scopes", required_scopes)
    except Exception:
        pass

    try:
        resp = await http_post(
            f"{BACKEND_URL}/api/public/v1/bots/{BOT_ID}/permissions/grant",
            json={"user_id": user_id, "scopes": required_scopes},
            headers=_bot_headers(),
        )
        if resp.status_code == 200:
            kb = ReplyKeyboardBuilder()
            kb.row(
                KeyboardButton("🎮 Игры", css_class="rk-btn rk-purple"),
                KeyboardButton("💰 Пополнить", css_class="rk-btn rk-green"),
            )
            kb.row(KeyboardButton("ℹ️ Помощь", css_class="rk-btn rk-gray"))
            await bot.send_message(
                chat_id,
                "✅ Разрешения предоставлены! Теперь вы можете пользоваться ботом.",
                reply_markup=kb.as_markup(),
            )
        else:
            await bot.send_message(chat_id, "❌ Не удалось сохранить разрешения. Попробуйте позже.")
    except Exception as e:
        logger.error("consent_grant error: %s", e)
        await bot.send_message(chat_id, "❌ Ошибка сервера.")
    await safe_answer(bot, callback.id)


# ── Registration ──────────────────────────────────────────────

@dp.callback_query(lambda c: c.data == "register")
async def register_user(callback: CallbackQuery, bot: Bot, state: FSMContext):
    user_id = str(callback.from_user.id)
    chat_id = str(callback.message.chat.id)

    # Auto-grant basic permissions on registration
    try:
        await http_post(f"{BACKEND_URL}/api/public/v1/bots/{BOT_ID}/permissions/grant",
                        json={"user_id": user_id, "scopes": "basic_profile,send_messages"},
                        headers=_bot_headers())
    except Exception:
        pass

    builder = InlineKeyboardBuilder()
    builder.row(
        InlineKeyboardButton("🔗 Привязать аккаунт", callback_data="link_yandex"),
        InlineKeyboardButton("✅ Готово", callback_data="register_done"),
    )
    await bot.send_message(chat_id,
                           "✅ Регистрация! Теперь привяжите аккаунт Вондик:",
                           reply_markup=builder.as_markup())
    await safe_answer(bot, callback.id)


@dp.callback_query(lambda c: c.data == "register_done")
async def register_done(callback: CallbackQuery, bot: Bot):
    kb = ReplyKeyboardBuilder()
    kb.row(
        KeyboardButton("🎮 Игры", css_class="rk-btn rk-purple"),
        KeyboardButton("💰 Пополнить", css_class="rk-btn rk-green"),
    )
    kb.row(KeyboardButton("ℹ️ Помощь", css_class="rk-btn rk-gray"))
    await bot.send_message(str(callback.message.chat.id),
                           "🎉 Готово! Используйте кнопки ниже:", reply_markup=kb.as_markup())
    await safe_answer(bot, callback.id)


# ── Balance / Topup ────────────────────────────────────────────

@dp.callback_query(lambda c: c.data == "premium")
async def balance_from_inline(callback: CallbackQuery, bot: Bot, state: FSMContext):
    user_id = str(callback.from_user.id)
    linked = None
    try:
        resp = await http_post(f"{BACKEND_URL}/api/v1/users/get", json={"user_id": user_id})
        if resp.status_code == 200:
            linked = resp.json()
    except Exception:
        pass

    if not linked:
        builder = InlineKeyboardBuilder()
        builder.add(InlineKeyboardButton(text="🔗 Привязать аккаунт", callback_data="link_yandex"))
        await bot.send_message(str(callback.message.chat.id), "Сначала привяжите аккаунт.", reply_markup=builder.as_markup())
        await safe_answer(bot, callback.id)
        return

    bal = linked.get("balance", 0)
    bonus = linked.get("bonus_balance", 0)
    builder = InlineKeyboardBuilder()
    builder.row(InlineKeyboardButton(text="💳 Пополнить баланс", callback_data="topup"))
    await bot.send_message(
        str(callback.message.chat.id),
        f"💰 Баланс: {bal}₽\n🎁 Бонус: {bonus}₽\n\nИтого: {bal + bonus}₽",
        reply_markup=builder.as_markup(),
    )
    await safe_answer(bot, callback.id)


@dp.callback_query(lambda c: c.data == "topup")
async def topup_handler(callback: CallbackQuery, bot: Bot):
    builder = InlineKeyboardBuilder()
    builder.row(InlineKeyboardButton(text="💳 Перейти к оплате", url=f"{FRONTEND_URL}/feed/settings"))
    await bot.send_message(
        str(callback.message.chat.id),
        "💳 **Пополнение баланса**\n\n"
        "Нажмите кнопку ниже, чтобы перейти к оплате.\n"
        "После оплаты баланс будет зачислен автоматически.",
        reply_markup=builder.as_markup(),
    )
    await safe_answer(bot, callback.id)


# ── Games ─────────────────────────────────────────────────────

@dp.callback_query(lambda c: c.data == "games:list" or (c.data and c.data.startswith("games:list")))
async def games_list(callback: CallbackQuery, bot: Bot, state: FSMContext):
    chat_id = str(callback.message.chat.id)
    try:
        data = await bot.list_games()
        games = data.get("games") if isinstance(data, dict) else []
        if not games:
            await bot.send_message(chat_id, "🎮 Пока нет игр.")
            await safe_answer(bot, callback.id)
            return
        builder = InlineKeyboardBuilder()
        for g in games[:12]:
            gid = g.get("id")
            title = g.get("title") or "Игра"
            if gid:
                builder.row(game_play_button(str(gid), str(title)))
        builder.row(play_games_button("🔄 Обновить"))
        await bot.send_message(chat_id, "🎮 Выберите игру:", reply_markup=builder.as_markup())
    except Exception:
        await bot.send_message(chat_id, "❌ Не удалось загрузить список игр.")
    await safe_answer(bot, callback.id)


@dp.callback_query(lambda c: c.data and c.data.startswith("game:play:"))
async def game_play(callback: CallbackQuery, bot: Bot, state: FSMContext):
    chat_id = str(callback.message.chat.id)
    game_id = callback.data.split(":", 2)[-1]
    try:
        await bot.send_game(chat_id, game_id, text="🎮 Запуск…")
    except Exception:
        await bot.send_message(chat_id, "❌ Игра недоступна.")
    await safe_answer(bot, callback.id)


# ── Join Requests & Consent ───────────────────────────────────

@dp.callback_query(lambda c: c.data and c.data.startswith("consent_grant:"))
async def handle_consent_grant(callback: CallbackQuery, bot: Bot):
    user_id = callback.data.split(":", 1)[1]
    try:
        resp = await http_post(
            f"{BACKEND_URL}/api/public/v1/bots/{BOT_ID}/permissions/grant",
            json={"user_id": user_id, "scopes": "basic_profile,send_messages"},
            timeout=5,
            headers=_bot_headers(),
        )
        if resp.status_code == 200:
            await bot.send_message(str(callback.message.chat.id), "✅ Разрешения успешно предоставлены! Теперь вы можете полноценно использовать бота.")
            await safe_answer(bot, callback.id, text="Доступ разрешен!")
        else:
            await safe_answer(bot, callback.id, text="Ошибка при сохранении прав", show_alert=True)
    except Exception as e:
        logger.error("Error granting consent: %s", e)
        await safe_answer(bot, callback.id, text="Ошибка соединения", show_alert=True)


@dp.callback_query(lambda c: c.data and (c.data.startswith("join_approve:") or c.data.startswith("join_decline:")))
async def handle_join_request_action(callback: CallbackQuery, bot: Bot):
    action, req_id = callback.data.split(":", 1)
    endpoint = f"{BACKEND_URL}/api/v1/join-requests/approve" if action == "join_approve" else f"{BACKEND_URL}/api/v1/join-requests/decline"
    try:
        resp = await http_post(
            endpoint,
            json={"request_id": req_id},
            timeout=5,
            headers=_bot_headers(),
        )
        if resp.status_code == 200:
            msg = "✅ Вы приняли заявку на вступление." if action == "join_approve" else "❌ Вы отклонили заявку на вступление."
            await bot.send_message(str(callback.message.chat.id), msg)
            await safe_answer(bot, callback.id, text=msg)
        else:
            err = resp.json().get("detail") if resp.status_code != 500 else "Ошибка обработки"
            await safe_answer(bot, callback.id, text=f"⚠️ {err or 'Ошибка'}", show_alert=True)
    except Exception as e:
        logger.error("Error processing join request callback: %s", e)
        await safe_answer(bot, callback.id, text="❌ Ошибка связи с сервером", show_alert=True)


# ── Link Yandex ───────────────────────────────────────────────

@dp.callback_query(lambda c: c.data == "link_yandex")
async def link_yandex(callback: CallbackQuery, bot: Bot):
    link_url = f"{FRONTEND_URL}/feed/settings"
    builder = InlineKeyboardBuilder()
    builder.add(InlineKeyboardButton(text="🔗 Открыть настройки", url=link_url))
    await bot.send_message(str(callback.message.chat.id),
                           "Перейдите в настройки и привяжите аккаунт Яндекса.",
                           reply_markup=builder.as_markup())
    await safe_answer(bot, callback.id)


# ── Run ───────────────────────────────────────────────────────

async def main():
    if not BOT_TOKEN:
        logger.error("BOT_TOKEN не установлен.")
        return
    bot = Bot(bot_id=BOT_ID, token=BOT_TOKEN, base_url=BACKEND_URL)
    await dp.start_polling(bot)


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        pass
