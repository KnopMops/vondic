# BotikSDK

Telegram Bot Framework для платформы Vondic.

## Установка

```bash
pip install botiksdk
```

## Быстрый старт

```python
import asyncio
from botiksdk import Bot, Dispatcher, Command, InlineKeyboardBuilder, InlineKeyboardButton

dp = Dispatcher()
bot = Bot(token="your-bot-token", base_url="http://localhost:5050")

@dp.message(Command("start"))
async def cmd_start(message, bot, state):
    builder = InlineKeyboardBuilder()
    builder.add(InlineKeyboardButton(text="Нажми меня", callback_data="pressed"))
    await bot.send_message(
        str(message.chat.id),
        "Привет!",
        reply_markup=builder.as_markup(),
    )

@dp.callback_query(lambda c: c.data == "pressed")
async def on_button_pressed(callback, bot, state):
    await bot.send_message(
        str(callback.message.chat.id),
        "Кнопка нажата!",
    )
    await bot.answer_callback_query(callback.id)

async def main():
    await dp.start_polling(bot)

if __name__ == "__main__":
    asyncio.run(main())
```

## Возможности

- **Dispatcher** - диспетчер для обработки обновлений
- **Router** - маршрутизатор для группировки хендлеров
- **FSM (Finite State Machine)** - машина состояний для диалогов
- **Filters** - фильтры для сообщений и callback query
- **Inline Keyboard** - конструктор кнопок

## Классы

### Bot

Основной класс для взаимодействия с API:

```python
bot = Bot(
    bot_id="your-bot-id",  # опционально
    token="your-bot-token",
    base_url="http://localhost:5050",  # опционально
)
```

Методы:
- `send_message(chat_id, text, parse_mode, reply_markup)` - отправка сообщения
- `answer_callback_query(callback_query_id, text, show_alert)` - ответ на callback
- `get_updates(offset, limit, timeout)` - получение обновлений
- `get_user_profile_photos(user_id, limit)` - получение фото профиля
- `get_file(file_id)` - получение файла

### Dispatcher

Диспетчер для обработки обновлений:

```python
dp = Dispatcher()

@dp.message(Command("start"))
async def start_handler(message, bot, state):
    ...

@dp.callback_query(lambda c: c.data.startswith("buy_"))
async def buy_handler(callback, bot, state):
    ...

@dp.message(lambda m: m.text is not None, state="some_state")
async def state_handler(message, bot, state):
    ...
```

### FSMContext

Контекст машины состояний:

```python
@dp.message(Command("email"))
async def ask_email(message, bot, state):
    await state.set_state("waiting_email")
    await bot.send_message(str(message.chat.id), "Введите email:")

@dp.message(lambda m: m.text is not None, state="waiting_email")
async def receive_email(message, bot, state):
    await state.update_data(email=message.text)
    await state.clear()
```

### Filters

Встроенные фильтры:

- `Command("start", "help")` - команды
- `Text(equals="hello")` - точное совпадение текста
- `Text(contains="world")` - текст содержит подстроку
- `Regex(r"\d+")` - регулярное выражение
- `F.message.text.contains("hello")` - фильтр по полю
- `lambda c: c.data.startswith("buy_")` - lambda фильтр

### InlineKeyboardBuilder

Конструктор кнопок:

```python
builder = InlineKeyboardBuilder()
builder.row(
    InlineKeyboardButton(text="Кнопка 1", callback_data="btn1"),
    InlineKeyboardButton(text="Кнопка 2", callback_data="btn2"),
)
builder.add(InlineKeyboardButton(text="URL", url="https://example.com"))
markup = builder.as_markup()
```

## Примеры

### Регистрация пользователя

```python
@dp.callback_query(lambda c: c.data == "register")
async def register(callback, bot, state):
    user_id = str(callback.from_user.id)
    # Ваша логика регистрации
    await bot.send_message(
        str(callback.message.chat.id),
        f"Вы зарегистрированы! ID: {user_id}",
    )
    await bot.answer_callback_query(callback.id)
```

### Покупка товаров

```python
@dp.callback_query(lambda c: c.data.startswith("buy_item"))
async def buy_item(callback, bot, state):
    _, item_id = callback.data.split(":")
    # Логика покупки
    builder = InlineKeyboardBuilder()
    builder.add(InlineKeyboardButton(text="Оплатить", url="https://payment.url"))
    await bot.send_message(
        str(callback.message.chat.id),
        f"Товар {item_id} добавлен в корзину",
        reply_markup=builder.as_markup(),
    )
    await bot.answer_callback_query(callback.id)
```

### Машина состояний

```python
class States:
    email = "email"
    password = "password"

@dp.message(Command("login"))
async def login_start(message, bot, state):
    await state.set_state(States.email)
    await bot.send_message(str(message.chat.id), "Введите email:")

@dp.message(lambda m: m.text is not None, state=States.email)
async def login_email(message, bot, state):
    await state.update_data(email=message.text)
    await state.set_state(States.password)
    await bot.send_message(str(message.chat.id), "Введите пароль:")

@dp.message(lambda m: m.text is not None, state=States.password)
async def login_password(message, bot, state):
    data = await state.get_data()
    email = data.get("email")
    password = message.text
    # Логика входа
    await state.clear()
    await bot.send_message(str(message.chat.id), "Вход выполнен!")
```

## Лицензия

MIT
