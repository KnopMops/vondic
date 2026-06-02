# Технические требования — Vondic OAuth & Chat API

Конкретные цифры и ограничения для архитекторов и разработчиков клиентов.

---

## 1. Общие требования к сети

| Параметр | Значение |
|----------|----------|
| **Протокол** | HTTPS (обязателен в production) |
| **TLS** | Терминация на nginx; приложение Flask не требует TLS напрямую |
| **HTTP → HTTPS** | Автоматический 301-редирект на уровне nginx |
| **CORS** | Выставляется nginx для разрешённых Origin (см. ниже) |

### Разрешённые CORS Origin (nginx)

```
https://vondic.knopusmedia.ru
http://localhost:3000
http://127.0.0.1:3000
http://localhost:5000
http://localhost:1420
http://127.0.0.1:1420
tauri://localhost
```

+ дополнительные из переменных окружения `FRONTEND_URL` и `CORS_ALLOWED_ORIGINS`.

---

## 2. OAuth 2.0

### 2.1. Поддерживаемый flow

| Параметр | Значение |
|----------|----------|
| **Grant types** | `authorization_code`, `refresh_token` |
| **PKCE** | ❌ Не поддерживается |
| **Authorization endpoint** | `GET` / `POST` `/oauth/authorize` |
| **Token endpoint** | `POST` `/oauth/token` |
| **Userinfo endpoint** | `GET` `/oauth/userinfo` |

### 2.2. Redirect URI

| Параметр | Значение |
|----------|----------|
| **Схемы** | Любые (`https://`, `http://`, `mygame://`, и т.д.) — без ограничений в коде |
| **Сопоставление** | Точное совпадение строки (после нормализации `localhost` ↔ `127.0.0.1`) |
| **Регистрация** | Список разрешённых URI хранится в поле `redirect_uris` OAuth-клиента (через запятую) |

### 2.3. Время жизни токенов

| Токен | TTL | Примечание |
|-------|-----|------------|
| **Authorization code** | **10 минут** | Одноразовый |
| **Access token** | **1 час (3600 сек)** | Возвращается поле `expires_in` |
| **Refresh token** | **1 час** | Отдельного refresh token нет; для обновления используется тот же `access_token`, пока не истёк |

### 2.4. Scopes

Сервер принимает scope, но **не ограничивает** доступ по ним (все авторизованные приложения получают полный доступ).

Декларируемые scope:

```
basic_profile, read_profile, read_posts, write_posts,
read_messages, write_messages
```

### 2.5. Формат credentials

| Параметр | Формат | Длина | Пример |
|----------|--------|-------|--------|
| **client_id** | UUID4 | 36 символов | `550e8400-e29b-41d4-a716-446655440000` |
| **client_secret** | UUID4 + UUID4(без дефисов) | 68 символов | `aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeeeffffffffffffffffffffffffffff` |

### 2.6. Rate limits (OAuth)

| Эндпоинт | Лимит |
|----------|-------|
| `POST /api/v1/auth/register` | 5 / 60 сек |
| `POST /api/v1/auth/login` | 10 / 60 сек |
| `POST /api/v1/auth/forgot-password` | 3 / 300 сек |
| `POST /api/v1/auth/socket-token` | 20 / 60 сек |

---

## 3. Chat REST API

### 3.1. Базовые URL

| Среда | URL |
|-------|-----|
| **REST API** | `https://api.vondic.knopusmedia.ru/api/public/v1/chat` |
| **OAuth** | `https://vondic.knopusmedia.ru/oauth` |
| **WebSocket** | `https://webrtc.vondic.knopusmedia.ru` (полный URL из `GET /config`) |

### 3.2. Аутентификация

Все защищённые эндпоинты принимают **один из** способов (приоритет: `access_token` > `api_key`):

```
X-API-Key: {api_key}
Authorization: ApiKey {api_key}
Authorization: Bearer {access_token}
?api_key={api_key}
?access_token={access_token}
JSON body: { "api_key": "..." } или { "access_token": "..." }
```

### 3.3. Rate limits

| Уровень | Лимит |
|---------|-------|
| **Глобальный** (все `/api/public/v1/...`) | **100 запросов / 60 сек** с одного IP |
| **Auth-эндпоинты** | см. раздел 2.6 |
| **WebSocket подключения** | **20 подключений / 60 сек** с одного IP |

При превышении: HTTP `429 Too Many Requests`.

### 3.4. Размеры и лимиты

| Параметр | Значение | Где ограничено |
|----------|----------|----------------|
| **Max request body** | **500 MB** | `nginx: client_max_body_size 500M` |
| **Загрузка файла (Free)** | **20 MB** | `backend/app/api/v1/upload.py` |
| **Загрузка файла (Premium)** | **100 MB** | `backend/app/api/v1/upload.py` |
| **Загрузка видео** | до 500 MB | nginx |

### 3.5. Поддерживаемые типы сообщений

```
text (по умолчанию)
image
voice
file
call_invite
```

### 3.6. Допустимые расширения загрузок

| Тип | Расширения |
|-----|------------|
| **Voice** | `wav`, `mp3`, `ogg`, `webm`, `m4a` |
| **Video** | `mp4`, `mov`, `webm`, `mkv`, `avi` |
| **File** | любые (fallback `bin`) |

### 3.7. Таймауты

| Операция | Таймаут |
|----------|---------|
| **Прокси REST → WebRTC** | 15 сек |
| **Online-users polling** | 5 сек |
| **Загрузка файла на static** | 30 сек |
| **Статические ресурсы** | 10 сек |
| **nginx proxy_read_timeout** | 60 сек (дефолт) |

### 3.8. Формат данных

- **Content-Type:** `application/json`
- **Кодировка:** UTF-8
- **Поля дат:** ISO 8601 (`2025-05-17T10:00:00`)
- **UUID:** строковый UUID4

---

## 4. WebSocket / Realtime

### 4.1. Технология

| Параметр | Значение |
|----------|----------|
| **Библиотека сервера** | Flask-SocketIO ≥ 5.6.0 |
| **Async mode** | eventlet |
| **Транспорты** | `websocket`, `polling` |
| **Путь** | `/socket.io/?EIO=4&transport=websocket` (стандартный Engine.IO v4) |

### 4.2. CORS (WebSocket)

Задаётся динамически в `webrtc/main.py`:

```python
cors_allowed_origins = [
    "https://vondic.knopusmedia.ru",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:5000",
    "http://localhost:1420",
    "http://127.0.0.1:1420",
    "tauri://localhost",
    # + CORS_ALLOWED_ORIGINS, FRONTEND_URL из env
]
```

### 4.3. Heartbeat

| Механизм | Интервал | Примечание |
|----------|----------|------------|
| **Engine.IO ping/pong** | ~25 сек / timeout 5 сек | Дефолт библиотеки python-socketio v5 |
| **Кастомный `ping_stability`** | Зависит от клиента | Клиент шлёт `ping_stability`, сервер отвечает `pong_stability` |

### 4.4. Авторизация в WebSocket

1. При подключении можно передать `auth: { token: apiKey }` (Socket.IO v4).
2. Обязательно отправить событие `authenticate` с `access_token`:
   ```json
   { "access_token": "api_key_или_bearer_token" }
   ```

### 4.5. Основные события

| Событие | Направление | Описание |
|---------|-------------|----------|
| `authenticate` | → сервер | Авторизация после подключения |
| `send_message` | → сервер | Отправить сообщение |
| `receive_message` | ← сервер | Новое сообщение |
| `get_group_history` | → сервер | Запросить историю группы |
| `group_history` | ← сервер | Ответ с историей |
| `ping_stability` | → сервер | Кастомный heartbeat |
| `pong_stability` | ← сервер | Ответ на heartbeat |
| `logout` | → сервер | Отключение |

---

## 5. Инфраструктура / nginx

### 5.1. SSL

- nginx слушает **443 ssl** с сертификатами:
  - `/etc/nginx/ssl/vondic.knopusmedia.ru.crt`
  - `/etc/nginx/ssl/vondic.knopusmedia.ru.key`
- HTTP запросы редиректятся на HTTPS.

### 5.2. Проксирование

| Upstream | Proxy pass |
|----------|------------|
| `api.vondic...` / `vondic...` | `backend:5050` |
| `webrtc.vondic...` | `webrtc:5000` |

### 5.3. Заголовки

nginx добавляет:
```
X-Real-IP
X-Forwarded-For
X-Forwarded-Proto
```

---

## 6. Чек-лист интеграции

### Перед началом разработки
- [ ] Зарегистрировать OAuth Application (получить `client_id` + `client_secret`)
- [ ] Добавить `redirect_uri` в настройки приложения
- [ ] Убедиться, что Origin игры/приложения разрешён в CORS (`CORS_ALLOWED_ORIGINS`)
- [ ] Для WebSocket: проверить, что домен игры есть в `cors_allowed_origins` WebRTC-сервера

### При разработке
- [ ] Использовать только HTTPS в production
- [ ] API Key хранить на backend игры, не в клиентском билде
- [ ] Реализовать обработку `429` (rate limit) с exponential backoff
- [ ] Для Unity/WebGL: использовать `UnityWebRequest` вместо `HttpClient`
- [ ] Для WebSocket: использовать Socket.IO-клиент (не чистый WebSocket) или REST-polling

### При тестировании
- [ ] Проверить `localhost`/`127.0.0.1` redirect URI для dev-окружения
- [ ] Убедиться, что `access_token` обновляется до истечения (1 час)
- [ ] Проверить поведение при `403` (пользователь не в группе)
- [ ] Проверить загрузку файлов граничного размера (20 MB / 100 MB)

---

**Последнее обновление:** May 2026
