# BotikSDK Documentation

BotikSDK is a Python framework for creating bots on the Vondic platform. It provides a simple and intuitive interface for handling messages, callback queries, and state management.

## Table of Contents

1. [Overview](#overview)
2. [Installation](#installation)
3. [Quick Start](#quick-start)
4. [Core Concepts](#core-concepts)
5. [Filters](#filters)
6. [Message Handling](#message-handling)
7. [Callback Query Handling](#callback-query-handling)
8. [Inline Keyboards](#inline-keyboards)
9. [FSM (Finite State Machine)](#fsm-finite-state-machine)
10. [API Methods (PublicAPIClient)](#api-methods-publicapiclient)
11. [Authentication Methods](#authentication-methods)
12. [Examples](#examples)
13. [Error Handling](#error-handling)
14. [Best Practices](#best-practices)

---

## Overview

BotikSDK allows you to:
- Create interactive bots for the Vondic platform
- Handle messages and callback queries
- Manage conversation state with FSM (Finite State Machine)
- Send messages, photos, and inline keyboards
- Integrate with Vondic's Public API

### Key Features

- **Simple Decorators** - Use `@dp.message()` and `@dp.callback_query()` decorators
- **Powerful Filters** - Filter messages by command, text, regex, and more
- **State Management** - Built-in FSM for multi-step conversations
- **Inline Keyboards** - Easy-to-use builder for interactive buttons
- **Public API Client** - Access Vondic's API with API keys or OAuth tokens

---

## Installation

```bash
pip install botiksdk
```

### Requirements

- Python 3.8+
- `requests` library (automatically installed)

---

## Quick Start

Here's a minimal bot that responds to the `/start` command:

```python
import asyncio
from botiksdk import Bot, Dispatcher, Command

# Initialize
dp = Dispatcher()
bot = Bot(token="your-bot-token", base_url="https://vondic.knopusmedia.ru")

@dp.message(Command("start"))
async def cmd_start(message, bot, state):
    await bot.send_message(
        str(message.chat.id),
        "Hello! I'm a Vondic bot powered by BotikSDK."
    )

async def main():
    await dp.start_polling(bot)

if __name__ == "__main__":
    asyncio.run(main())
```

---

## Core Concepts

### Bot Class

The `Bot` class is your interface to the Vondic API.

```python
from botiksdk import Bot

bot = Bot(
    bot_id="your-bot-id",      # Optional: auto-detected from token
    token="your-bot-token",     # Required for bot operations
    base_url="https://vondic.knopusmedia.ru",  # API base URL
    api_key="your-api-key",     # Optional: for account operations
)
```

#### Methods

| Method | Description |
|--------|-------------|
| `send_message(chat_id, text, parse_mode, reply_markup)` | Send a text message |
| `answer_callback_query(callback_query_id, text, show_alert)` | Answer a callback query |
| `get_updates(offset, limit, timeout)` | Get incoming updates |
| `get_user_profile_photos(user_id, limit)` | Get user's profile photos |
| `get_file(file_id)` | Get file information |

### Dispatcher Class

The `Dispatcher` routes incoming updates to your handlers.

```python
from botiksdk import Dispatcher

dp = Dispatcher()

# Register handlers
@dp.message(Command("help"))
async def help_handler(message, bot, state):
    ...

# Start polling
await dp.start_polling(bot)
```

#### Methods

| Method | Description |
|--------|-------------|
| `message(*filters, state=None)` | Decorator for message handlers |
| `callback_query(*filters, state=None)` | Decorator for callback handlers |
| `include_router(router)` | Include a Router in the dispatcher |
| `fsm_context(user_id, chat_id)` | Get FSM context for a user/chat |
| `start_polling(*bots)` | Start polling for updates |

### Router Class

Use `Router` to organize handlers into logical groups.

```python
from botiksdk import Router

# Create routers for different features
admin_router = Router()
user_router = Router()

@admin_router.message(Command("admin"))
async def admin_handler(message, bot, state):
    ...

# Include in main dispatcher
dp.include_router(admin_router)
dp.include_router(user_router)
```

---

## Filters

Filters allow you to control which handlers process which updates.

### Built-in Filters

#### Command Filter

Filter messages that start with a command:

```python
from botiksdk import Command

@dp.message(Command("start", "help", "about"))
async def command_handler(message, bot, state):
    ...
```

#### Text Filter

Filter by exact text or substring:

```python
from botiksdk import Text

# Exact match
@dp.message(Text(equals="hello"))
async def hello_handler(message, bot, state):
    ...

# Contains substring
@dp.message(Text(contains="world"))
async def world_handler(message, bot, state):
    ...
```

#### Regex Filter

Filter using regular expressions:

```python
from botiksdk import Regex

@dp.message(Regex(r"\d+"))  # Messages containing digits
async def digits_handler(message, bot, state):
    ...
```

#### CallbackDataFilter

Filter callback queries by data prefix:

```python
from botiksdk import CallbackDataFilter

@dp.callback_query(CallbackDataFilter(prefix="buy_"))
async def buy_handler(callback, bot, state):
    ...
```

#### Custom Filters

Create custom filters with lambda functions:

```python
# Lambda filter
@dp.message(lambda m: m.text and len(m.text) > 100)
async def long_message_handler(message, bot, state):
    ...

# Lambda for callback queries
@dp.callback_query(lambda c: c.data and c.data.startswith("action_"))
async def action_handler(callback, bot, state):
    ...
```

#### Field Filter (F)

Use the `F` accessor for powerful field-based filtering:

```python
from botiksdk import F

# Filter by message text
@dp.message(F.message.text.contains("hello"))
async def hello_handler(message, bot, state):
    ...

# Filter by user ID
@dp.message(F.message.from_user.id == "12345")
async def specific_user_handler(message, bot, state):
    ...
```

---

## Message Handling

### Basic Message Handler

```python
@dp.message()
async def echo_handler(message, bot, state):
    # Echo the message back
    await bot.send_message(
        str(message.chat.id),
        f"You said: {message.text}"
    )
```

### Message Object

The `message` parameter provides access to:

| Attribute | Type | Description |
|-----------|------|-------------|
| `message_id` | `str` | Unique message identifier |
| `text` | `str \| None` | Message text |
| `from_user` | `User \| None` | Sender information |
| `chat` | `Chat \| None` | Chat information |
| `date` | `datetime \| None` | Message timestamp |
| `photo` | `List[PhotoSize] \| None` | Photos in the message |

### User Object

| Attribute | Type | Description |
|-----------|------|-------------|
| `id` | `str` | User ID |
| `username` | `str \| None` | Username |
| `first_name` | `str \| None` | First name |
| `last_name` | `str \| None` | Last name |

### Chat Object

| Attribute | Type | Description |
|-----------|------|-------------|
| `id` | `str` | Chat ID |
| `type` | `str` | Chat type (private, group, etc.) |
| `title` | `str \| None` | Chat title |

---

## Callback Query Handling

Handle button clicks from inline keyboards:

```python
@dp.callback_query(lambda c: c.data == "button_clicked")
async def on_button_click(callback, bot, state):
    # Answer the callback query
    await bot.answer_callback_query(
        callback.id,
        text="Button clicked!",
        show_alert=False
    )
    
    # Edit the message (optional)
    await bot.send_message(
        str(callback.message.chat.id),
        "You clicked the button!"
    )
```

### CallbackQuery Object

| Attribute | Type | Description |
|-----------|------|-------------|
| `id` | `str` | Callback query ID |
| `from_user` | `User \| None` | User who clicked |
| `message` | `Message \| None` | Original message |
| `data` | `str` | Callback data |

---

## Inline Keyboards

Create interactive buttons using `InlineKeyboardBuilder`:

```python
from botiksdk import InlineKeyboardBuilder, InlineKeyboardButton

@dp.message(Command("menu"))
async def show_menu(message, bot, state):
    builder = InlineKeyboardBuilder()
    
    # Add buttons in a row
    builder.row(
        InlineKeyboardButton(text="Option 1", callback_data="opt1"),
        InlineKeyboardButton(text="Option 2", callback_data="opt2"),
    )
    
    # Add another button
    builder.add(InlineKeyboardButton(text="Visit Website", url="https://example.com"))
    
    # Send message with keyboard
    await bot.send_message(
        str(message.chat.id),
        "Choose an option:",
        reply_markup=builder.as_markup()
    )
```

### InlineKeyboardButton

| Parameter | Type | Description |
|-----------|------|-------------|
| `text` | `str` | Button label (required) |
| `callback_data` | `str \| None` | Data sent when clicked |
| `url` | `str \| None` | URL to open when clicked |

### InlineKeyboardBuilder Methods

| Method | Description |
|--------|-------------|
| `row(*buttons)` | Add a row of buttons |
| `add(button)` | Add a button to current row |
| `as_markup()` | Build the keyboard markup |

---

## FSM (Finite State Machine)

Manage multi-step conversations with FSM.

### Defining States

```python
class States:
    WAITING_EMAIL = "waiting_email"
    WAITING_PASSWORD = "waiting_password"
    CONFIRMED = "confirmed"
```

### Setting State

```python
@dp.message(Command("register"))
async def start_registration(message, bot, state):
    await state.set_state(States.WAITING_EMAIL)
    await bot.send_message(
        str(message.chat.id),
        "Please enter your email:"
    )
```

### Handling State

```python
@dp.message(state=States.WAITING_EMAIL)
async def process_email(message, bot, state):
    email = message.text
    await state.update_data(email=email)
    await state.set_state(States.WAITING_PASSWORD)
    await bot.send_message(
        str(message.chat.id),
        "Now enter your password:"
    )

@dp.message(state=States.WAITING_PASSWORD)
async def process_password(message, bot, state):
    data = await state.get_data()
    email = data.get("email")
    password = message.text
    
    # Process registration...
    await state.clear()
    await state.set_state(States.CONFIRMED)
    await bot.send_message(
        str(message.chat.id),
        f"Registered! Email: {email}"
    )
```

### FSMContext Methods

| Method | Description |
|--------|-------------|
| `set_state(state)` | Set current state |
| `get_state()` | Get current state |
| `set_data(data)` | Set state data |
| `get_data()` | Get state data |
| `update_data(data)` | Update state data |
| `clear()` | Clear state and data |

---

## API Methods (PublicAPIClient)

The `PublicAPIClient` class provides access to Vondic's Public API.

### Initialization

```python
from botiksdk.client import PublicAPIClient

client = PublicAPIClient(base_url="https://vondic.knopusmedia.ru")
```

### Bot Management

#### List All Bots

```python
bots = client.list_bots(api_key="your-api-key")
# Returns: [{"id": "...", "name": "...", ...}, ...]
```

#### Get Specific Bot

```python
bot = client.get_bot(bot_id="bot123", api_key="your-api-key")
```

#### Get Bot by Name

```python
bot = client.get_bot_by_name(name="my_bot", api_key="your-api-key")
```

#### Search Bots

```python
results = client.search_bots(query="search term", api_key="your-api-key")
```

#### Generate Bot Token

```python
token_data = client.generate_bot_token(
    bot_id="bot123",
    api_key="your-api-key"
)
# Returns: {"token": "...", "expires_at": ...}
```

### Working with Updates

#### Get Updates

```python
updates = client.get_updates(
    bot_id="bot123",
    bot_token="bot-token",
    offset=0,
    limit=100,
    timeout=20,
)
# Returns: [{"update_id": "...", "message": {...}}, ...]
```

#### Push Update (Manual)

```python
client.push_update(
    bot_id="bot123",
    bot_token="bot-token",
    message={"text": "Hello", "chat": {"id": "456"}},
)
```

### Sending Messages

```python
result = client.send_message(
    bot_id="bot123",
    bot_token="bot-token",
    chat_id="456",
    text="Hello, World!",
    parse_mode="HTML",
    reply_markup={
        "inline_keyboard": [[
            {"text": "OK", "callback_data": "ok"}
        ]]
    },
)
```

### Answering Callbacks

```python
client.answer_callback_query(
    bot_id="bot123",
    bot_token="bot-token",
    callback_query_id="query_id",
    text="Processed!",
    show_alert=False,
)
```

### Working with Files

#### Get User Profile Photos

```python
photos = client.get_user_profile_photos(
    bot_id="bot123",
    bot_token="bot-token",
    user_id="456",
    offset=0,
    limit=10,
)
# Returns: {"total_count": 1, "photos": [...]}
```

#### Get File Info

```python
file_info = client.get_file(
    bot_id="bot123",
    bot_token="bot-token",
    file_id="file_id_here",
)
# Returns: {"file_id": "...", "file_path": "..."}
```

### Account Management (OAuth)

#### Get API Key Using OAuth Token

```python
api_key_data = client.get_api_key(access_token="user-oauth-token")
# Returns: {"api_key": "...", "user_id": "..."}
```

#### Generate New API Key

```python
new_key_data = client.generate_api_key(
    access_token="user-oauth-token",
    rotate=True,  # Rotates old key
)
# Returns: {"api_key": "...", "created_at": ...}
```

---

## Authentication Methods

BotikSDK supports multiple authentication methods:

### 1. Bot Token (Primary Method)

```python
bot = Bot(token="your-bot-token")

# Or use environment variable: BOT_TOKEN
# export BOT_TOKEN="your-bot-token"
```

### 2. OAuth Access Token

Get an API key using an OAuth access token:

```python
from botiksdk.client import PublicAPIClient

client = PublicAPIClient(base_url="https://vondic.knopusmedia.ru")

# Get API key using OAuth token
api_key_data = client.get_api_key(access_token="user-oauth-token")
api_key = api_key_data["api_key"]

# Now use the API key for bot operations
bots = client.list_bots(api_key=api_key)
```

### 3. API Key

Use an API key directly:

```python
client = PublicAPIClient(base_url="https://vondic.knopusmedia.ru")
bots = client.list_bots(api_key="your-api-key")
```

---

## Examples

### Complete Bot Example

```python
import asyncio
from botiksdk import Bot, Dispatcher, Command, Text, InlineKeyboardBuilder, InlineKeyboardButton

# Initialize
dp = Dispatcher()
bot = Bot(token="your-bot-token", base_url="https://vondic.knopusmedia.ru")

# /start command
@dp.message(Command("start"))
async def cmd_start(message, bot, state):
    builder = InlineKeyboardBuilder()
    builder.row(
        InlineKeyboardButton(text="Help", callback_data="help"),
        InlineKeyboardButton(text="About", callback_data="about"),
    )
    await bot.send_message(
        str(message.chat.id),
        "Welcome! Choose an option:",
        reply_markup=builder.as_markup()
    )

# Handle button clicks
@dp.callback_query(lambda c: c.data in ["help", "about"])
async def on_button_click(callback, bot, state):
    if callback.data == "help":
        text = "This is a help message!"
    else:
        text = "This is a bot built with BotikSDK!"
    
    await bot.answer_callback_query(callback.id)
    await bot.send_message(
        str(callback.message.chat.id),
        text
    )

# Echo handler
@dp.message()
async def echo(message, bot, state):
    if message.text:
        await bot.send_message(
            str(message.chat.id),
            f"You said: {message.text}"
        )

# Main function
async def main():
    await dp.start_polling(bot)

if __name__ == "__main__":
    asyncio.run(main())
```

### OAuth Integration Example

```python
import requests
from botiksdk.client import PublicAPIClient

# Step 1: User authorizes your app (see OAuth docs)
# User is redirected to: https://vondic.knopusmedia.ru/oauth/authorize?...

# Step 2: Exchange authorization code for access token
token_response = requests.post(
    "https://vondic.knopusmedia.ru/oauth/token",
    data={
        "grant_type": "authorization_code",
        "code": "auth_code_from_callback",
        "redirect_uri": "https://yourapp.com/callback",
        "client_id": "your_client_id",
        "client_secret": "your_client_secret",
    },
)
access_token = token_response.json()["access_token"]

# Step 3: Use access token to get API key
client = PublicAPIClient(base_url="https://vondic.knopusmedia.ru")
api_key_data = client.get_api_key(access_token=access_token)
api_key = api_key_data["api_key"]

# Step 4: Use API key for bot operations
bots = client.list_bots(api_key=api_key)
print(f"Found {len(bots)} bots!")
```

### FSM Registration Example

```python
class States:
    EMAAL = "email"
    PASSWORD = "password"
    CONFIRM = "confirm"

@dp.message(Command("register"))
async def register_start(message, bot, state):
    await state.set_state(States.EMAIL)
    await bot.send_message(str(message.chat.id), "Enter your email:")

@dp.message(state=States.EMAIL)
async def register_email(message, bot, state):
    await state.update_data(email=message.text)
    await state.set_state(States.PASSWORD)
    await bot.send_message(str(message.chat.id), "Enter your password:")

@dp.message(state=States.PASSWORD)
async def register_password(message, bot, state):
    data = await state.get_data()
    email = data.get("email")
    # In production, hash the password!
    password = message.text
    
    # Process registration...
    await state.clear()
    await bot.send_message(
        str(message.chat.id),
        f"Registration successful! Email: {email}"
    )
```

---

## Error Handling

BotikSDK provides specific exception classes:

```python
from botiksdk.exceptions import (
    APIError,
    UnauthorizedError,
    NotFoundError,
    BadRequestError,
)

try:
    bots = client.list_bots(api_key="invalid-key")
except UnauthorizedError as e:
    print(f"Authentication failed: {e}")
except NotFoundError as e:
    print(f"Resource not found: {e}")
except BadRequestError as e:
    print(f"Bad request: {e}")
except APIError as e:
    print(f"API error: {e}")
```

### Exception Classes

| Exception | Status Code | Description |
|-----------|-------------|-------------|
| `APIError` | Any | Base exception for API errors |
| `UnauthorizedError` | 401 | Invalid or missing authentication |
| `NotFoundError` | 404 | Resource not found |
| `BadRequestError` | 400 | Invalid request parameters |

---

## Best Practices

### 1. Use Environment Variables

```python
import os
from botiksdk import Bot

bot = Bot(
    token=os.getenv("BOT_TOKEN"),
    base_url=os.getenv("BOT_BASE_URL", "https://vondic.knopusmedia.ru")
)
```

### 2. Implement Error Handling

```python
@dp.message()
async def safe_handler(message, bot, state):
    try:
        # Your logic here
        await bot.send_message(str(message.chat.id), "Success!")
    except Exception as e:
        print(f"Error: {e}")
        await bot.send_message(str(message.chat.id), "An error occurred.")
```

### 3. Use Routers for Organization

```python
from botiksdk import Router

admin_router = Router()
user_router = Router()

# Admin commands
@admin_router.message(Command("ban"))
async def ban_user(message, bot, state):
    ...

# User commands  
@user_router.message(Command("start"))
async def start(message, bot, state):
    ...

# Include routers
dp.include_router(admin_router)
dp.include_router(user_router)
```

### 4. Clean Up State

Always clear FSM state when done:

```python
@dp.message(state=States.CONFIRMED)
async def finish_registration(message, bot, state):
    # Process...
    await state.clear()  # Important!
    await bot.send_message(str(message.chat.id), "Done!")
```

### 5. Use Proper Logging

```python
import logging

logging.basicConfig(level=logging.INFO)
```

---

## Support

For questions or issues with BotikSDK:
- Check this documentation
- Review the example applications in `docs/`
- Contact the Vondic development team

---

**Last Updated**: May 2026
