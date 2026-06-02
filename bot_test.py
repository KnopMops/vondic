import asyncio
import logging
import sys

import requests
from botiksdk import Bot, Dispatcher, Command

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ─── Конфигурация ───
BOT_TOKEN = "cjhUlUoDd4akrxDWGGsulvKsBnCIF8qtZapUjSKd8xs"
BOT_ID = "d9974399-a4e5-4de8-8f56-f86c1cad96eb"
GROUP_ID = "4af8c7e4-c69f-4e6c-aa66-89ecd7fe17e9"
BASE_URL = "https://vondic.knopusmedia.ru"
API_KEY = "KHLPiiSjR3GCXHeyGvJqogsEnn_rwtpj-kfSaaT0uRM"

# ─── Инициализация ───
dp = Dispatcher()
bot = Bot(token=BOT_TOKEN, bot_id=BOT_ID, base_url=BASE_URL)


# ═══════════════════════════════════════════════
# Хелпер для отправки через Chat API (API key)
# ═══════════════════════════════════════════════
def _chat_api_post(path: str, payload: dict):
    url = f"{BASE_URL}/api/public/v1/chat{path}"
    headers = {
        "X-API-Key": API_KEY,
        "Content-Type": "application/json",
    }
    return requests.post(url, headers=headers, json=payload, timeout=30)


async def chat_api_post(path: str, payload: dict):
    return await asyncio.to_thread(_chat_api_post, path, payload)


# ═══════════════════════════════════════════════
# Команда /message — отправка в группу
# ═══════════════════════════════════════════════
@dp.message(Command("message"))
async def send_to_group(message, bot, state):
    user_id = message.from_user.id if message.from_user else "unknown"
    logger.info(f"Получена команда от {user_id}: {message.text}")

    if not message.text:
        return

    parts = message.text.split(maxsplit=1)
    if len(parts) < 2 or not parts[1].strip():
        await bot.send_message(
            str(message.chat.id),
            "❌ Укажите текст после команды.\nПример: `/message Всем привет!`",
            parse_mode="Markdown",
        )
        return

    msg_text = parts[1].strip()

    try:
        resp = await chat_api_post(
            f"/groups/{GROUP_ID}/messages",
            {"content": msg_text, "type": "text"},
        )

        if resp.status_code == 201:
            await bot.send_message(
                str(message.chat.id),
                f"✅ Сообщение отправлено в группу:\n{msg_text[:200]}",
            )
        elif resp.status_code == 403:
            await bot.send_message(
                str(message.chat.id),
                "❌ У вас нет доступа к этой группе.\n"
                "Владелец API key должен быть её участником.",
            )
        else:
            try:
                err = resp.json().get("error", resp.text)
            except Exception:
                err = resp.text
            await bot.send_message(
                str(message.chat.id), f"⚠️ Ошибка сервера: {err}"
            )
            logger.error(f"Chat API error: {resp.status_code} {err}")
    except Exception as e:
        await bot.send_message(str(message.chat.id), f"⚠️ Ошибка: {e}")
        logger.exception("Ошибка при отправке сообщения")


async def main():
    logger.info("Бот запущен. Команда: /message <текст>")
    await dp.start_polling(bot)


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("Бот остановлен вручную")
        sys.exit(0)
