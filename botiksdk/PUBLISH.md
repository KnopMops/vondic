# Инструкция по публикации botiksdk на PyPI

## Подготовка

1. Убедитесь, что версия в `pyproject.toml` обновлена (текущая: 0.1.1)

2. Установите инструменты для сборки:
```bash
pip install build twine
```

## Сборка пакета

```bash
cd /home/knopmops/vondic/botiksdk
python -m build
```

Это создаст директорию `dist/` с файлами `.tar.gz` и `.whl`.

## Публикация на PyPI

### Тестирование (на TestPyPI)

```bash
twine upload --repository testpypi dist/*
```

Проверьте установку:
```bash
pip install --index-url https://test.pypi.org/simple/ botiksdk==0.1.1
```

### Публикация на основной PyPI

```bash
twine upload dist/*
```

Вам потребуется:
- Аккаунт на https://pypi.org/
- API token с правами на публикацию

## После публикации

1. Обновите `requirements.txt` в боте, если нужна новая версия
2. Протестируйте установку: `pip install botiksdk`
3. Запустите бота: `python bot/main.py`

## Что было добавлено в версии 0.1.1

- **CallbackQuery** - поддержка callback query от inline кнопок
- **FSM (Finite State Machine)** - машина состояний для диалогов
- **FSMContext** - контекст для хранения состояния и данных
- **Dispatcher.callback_query()** - регистрация хендлеров callback query
- **Router.callback_query()** - маршрутизация callback query
- **InlineKeyboardBuilder** - конструктор inline кнопок
- **InlineKeyboardButton** - класс inline кнопки
- **CallbackDataFilter** - фильтр для callback query по префиксу
- **bot.answer_callback_query()** - ответ на callback query
- **bot.get_user_profile_photos()** - получение фото профиля пользователя
- **bot.get_file()** - получение файла по ID
- **send_message с reply_markup** - поддержка клавиатур в сообщениях
