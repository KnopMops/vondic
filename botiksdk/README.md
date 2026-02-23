# Vondic Botik SDK

A Python SDK for building bots on the Vondic platform.

## Installation

```bash
pip install botiksdk
```

## Usage

```python
from botiksdk import Bot, Dispatcher, Message

bot = Bot(token="YOUR_BOT_TOKEN")
dp = Dispatcher(bot)

@dp.message_handler()
async def echo(message: Message):
    await message.answer(message.text)

if __name__ == "__main__":
    dp.start_polling()
```
