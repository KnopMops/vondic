# BotikSDK

Python SDK для создания ботов на платформе Vontic. Полный функционал aiogram 3.x через Vontic API.

## Установка

```bash
pip install botiksdk
```

## Быстрый старт

```python
import os
from botiksdk import Bot, Dispatcher, Message, Command

bot = Bot(bot_id=os.getenv("BOT_ID"), token=os.getenv("BOT_TOKEN"))
dp = Dispatcher()
dp.include_bot(bot)

@dp.message(Command("start"))
async def start(message: Message, bot: Bot):
    await bot.send_message(str(message.chat.id), "Привет!")

dp.run_polling()
```

## Возможности

- **Команды и фильтры** — Command, Text, Regex, F, RateLimit, RequireScopes
- **Клавиатуры** — ReplyKeyboardBuilder, InlineKeyboardBuilder
- **Медиа** — photo, video, audio, voice, document, sticker, InputMedia (альбомы)
- **15+ типов сообщений** — text, photo, video, voice, poll, location, contact, dice...
- **Модерация** — ban, kick, restrict, promote, delete_message
- **Опросы** — send_poll, stop_poll
- **Consent permissions** — RequireScopes, check_permissions
- **FSM** — конечные автоматы для диалогов
- **Middleware** — pre/post обработка сообщений
- **Error handlers** — глобальная обработка ошибок
- **Startup/Shutdown** — хуки при запуске/остановке
- **Webhook** — set_webhook, delete_webhook
- **70+ методов Bot API**

## Документация

Подробная документация с примерами кода на русском: https://vondic.ru/api-docs

## Лицензия

MIT
