# OAuth test server (Flask + HTML)

Независимый тестовый сервер для OAuth авторизации через Вондик.

## Что умеет

- Открывает OAuth в popup-окне (как Google/Yandex UX)
- Получает `code/state` на callback
- Проверяет `state` (базовая CSRF защита)
- Меняет `code` на `access_token`
- Запрашивает `userinfo`

## Быстрый запуск

```bash
cd test
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

Заполни в `.env`:

- `VONDIC_CLIENT_ID`
- `VONDIC_CLIENT_SECRET`
- при необходимости `VONDIC_REDIRECT_URI`

Запуск:

```bash
export $(cat .env | xargs) && python app.py
```

Открой:

`http://127.0.0.1:5055`

## Важно

- `VONDIC_REDIRECT_URI` должен быть добавлен в redirect URIs OAuth приложения на сайте Вондик.
- Этот сервер не связан с остальным кодом проекта, кроме обращения к OAuth endpoint Вондик.
