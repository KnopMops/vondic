# Chat Embed API — документация

API для встраивания мессенджера Vondic в сторонние приложения (игры, десктоп, мобильные клиенты).

**Базовый URL:** `https://api.vondic.knopusmedia.ru/api/public/v1/chat`  
**WebSocket (realtime):** `https://webrtc.vondic.knopusmedia.ru` (см. `GET /config`)

---

## Содержание

1. [Авторизация](#авторизация)
2. [API-ключ](#api-ключ)
3. [Быстрый старт](#быстрый-старт)
4. [Эндпоинты](#эндпоинты)
5. [WebSocket (realtime)](#websocket-realtime)
6. [Форматы данных](#форматы-данных)
7. [Коды ошибок](#коды-ошибок)
8. [Примеры](#примеры)

---

## Авторизация

Все защищённые эндпоинты принимают **один из** способов:

| Способ | Пример |
|--------|--------|
| Заголовок `X-API-Key` | `X-API-Key: ваш_ключ` |
| Заголовок `Authorization` | `Authorization: ApiKey ваш_ключ` |
| Заголовок Bearer (сессия) | `Authorization: Bearer <access_token>` |
| Тело JSON | `{ "api_key": "..." }` или `{ "access_token": "..." }` |
| Query (GET) | `?api_key=...` или `?access_token=...` |

Приоритет: сначала проверяется `access_token`, затем `api_key`.

**Рекомендация для встраивания:** используйте **API-ключ** — один секрет на приложение/бота, без OAuth-редиректов.

---

## API-ключ

### Получить или создать ключ

Требуется первичный вход (Bearer из `/api/v1/auth/login`) **один раз**, далее можно работать только по ключу.

```http
POST /api/public/v1/chat/api-key
Authorization: Bearer <access_token>
Content-Type: application/json

{}
```

Ответ:

```json
{
  "api_key": "длинная_строка_секрета"
}
```

Повторный запрос вернёт тот же ключ. Чтобы перевыпустить:

```json
{ "rotate": true }
```

### Посмотреть текущий ключ

```http
GET /api/public/v1/chat/api-key
X-API-Key: <ваш_ключ>
```

### Все дальнейшие запросы

```http
GET /api/public/v1/chat/me
X-API-Key: <ваш_ключ>
```

Ключ привязан к **вашему пользователю** Vondic: все действия выполняются от его имени.

---

## Быстрый старт

```bash
# 1. Конфиг (без авторизации)
curl https://api.vondic.knopusmedia.ru/api/public/v1/chat/config

# 2. Профиль
curl -H "X-API-Key: YOUR_KEY" \
  https://api.vondic.knopusmedia.ru/api/public/v1/chat/me

# 3. Отправить личное сообщение
curl -X POST -H "X-API-Key: YOUR_KEY" -H "Content-Type: application/json" \
  -d '{"content":"Привет!","type":"text"}' \
  https://api.vondic.knopusmedia.ru/api/public/v1/chat/dm/USER_ID/messages

# 4. История переписки
curl -H "X-API-Key: YOUR_KEY" \
  "https://api.vondic.knopusmedia.ru/api/public/v1/chat/dm/USER_ID/messages?per_page=50"
```

---

## Эндпоинты

### Конфиг и профиль

| Метод | Путь | Auth | Описание |
|-------|------|------|----------|
| `GET` | `/config` | нет | Версия API, URL WebSocket, список возможностей |
| `GET` | `/me` | да | Текущий пользователь |
| `POST` | `/auth/token` | да | Токен для WebSocket (из ключа или сессии) |
| `GET` | `/api-key` | да | Получить API-ключ |
| `POST` | `/api-key` | да | Создать/перевыпустить API-ключ |

**`GET /config`** — пример ответа:

```json
{
  "api_version": "1",
  "websocket_url": "https://webrtc.vondic.knopusmedia.ru",
  "features": {
    "direct_messages": true,
    "groups": true,
    "channels": true,
    "reactions": true,
    "replies": true,
    "forwards": true,
    "e2e_keys": true,
    "friends": true,
    "uploads": true,
    "realtime": true,
    "voice_calls": true
  }
}
```

---

### Личные сообщения (DM)

| Метод | Путь | Описание |
|-------|------|----------|
| `GET` | `/contacts/recent` | Недавние диалоги |
| `GET` | `/dm/{target_id}/messages` | История (`page`, `per_page`, `cursor`) |
| `POST` | `/dm/{target_id}/messages` | Отправить сообщение |
| `DELETE` | `/dm/{target_id}/messages/{message_id}` | Удалить своё сообщение |
| `DELETE` | `/dm/{target_id}/history` | Очистить переписку |

**Отправка сообщения:**

```json
{
  "content": "Текст",
  "type": "text",
  "attachments": [{"url": "https://...", "name": "file.png"}],
  "reply_to_id": "uuid-сообщения"
}
```

`type`: `text`, `image`, `file`, `voice` и др.

**Ответ списка сообщений:**

```json
{
  "items": [ { "id": "...", "content": "...", "sender_id": "...", "created_at": "..." } ],
  "total": 120,
  "pages": 3,
  "page": 1,
  "next_cursor": "2025-01-01T12:00:00"
}
```

---

### Группы

| Метод | Путь | Описание |
|-------|------|----------|
| `POST` | `/groups` | Создать группу |
| `POST` | `/groups/join` | Войти по `invite_code` |
| `GET` | `/groups` | Мои группы |
| `GET` | `/groups/{group_id}` | Информация о группе |
| `GET` | `/groups/{group_id}/participants` | Участники |
| `POST` | `/groups/{group_id}/participants` | Добавить участника `{"user_id":"..."}` |
| `GET` | `/groups/{group_id}/messages` | История |
| `POST` | `/groups/{group_id}/messages` | Отправить |
| `DELETE` | `/groups/{group_id}/messages/{message_id}` | Удалить своё |
| `DELETE` | `/groups/{group_id}/history` | Очистить (только владелец) |

**Создание группы:**

```json
{
  "name": "Клан",
  "description": "Описание",
  "is_private": false
}
```

---

### Каналы

| Метод | Путь | Описание |
|-------|------|----------|
| `POST` | `/channels` | Создать канал |
| `POST` | `/channels/join` | Войти по `invite_code` |
| `GET` | `/channels` | Мои каналы |
| `GET` | `/channels/{channel_id}` | Детали канала |
| `GET` | `/channels/{channel_id}/messages` | История |
| `POST` | `/channels/{channel_id}/messages` | Отправить |

---

### Действия с сообщениями

| Метод | Путь | Тело |
|-------|------|------|
| `POST` | `/messages/{id}/reaction` | `{"emoji":"👍"}` |
| `PUT` | `/messages/{id}/edit` | `{"content":"новый текст"}` (до 48 ч) |
| `POST` | `/messages/{id}/read` | — |
| `POST` | `/messages/{id}/reply` | `{"content":"..."}` |
| `POST` | `/messages/{id}/forward` | `{"target_id":"..."}` или `group_id` / `channel_id` |
| `POST` | `/messages/{id}/delete-for-everyone` | — (до 7 суток, только автор) |

---

### Друзья

| Метод | Путь | Описание |
|-------|------|----------|
| `GET` | `/friends` | Список друзей |
| `GET` | `/friends/requests` | Входящие заявки |
| `POST` | `/friends/request` | `{"friend_id":"..."}` |
| `POST` | `/friends/accept` | `{"requester_id":"..."}` |
| `POST` | `/friends/reject` | `{"requester_id":"..."}` |
| `POST` | `/friends/remove` | `{"friend_id":"..."}` |

---

### Пользователи и поиск

| Метод | Путь | Описание |
|-------|------|----------|
| `POST` | `/users/search` | `{"query":"ник"}` |
| `GET` | `/users/{user_id}` | Профиль |
| `POST` | `/presence` | `{"status":"online"}` или `"offline"` |

---

### Realtime (прокси WebRTC-сервера)

Работают с **API-ключом** (передаётся как `token` на signaling-сервер).

| Метод | Путь | Тело |
|-------|------|------|
| `POST` | `/realtime/dm/history` | `target_id`, `limit`, `offset` |
| `POST` | `/realtime/channels/history` | `channel_id`, `limit`, `offset` |
| `POST` | `/realtime/search/chats` | `query` |
| `POST` | `/realtime/search/messages` | `target_id`, `query` |
| `GET` | `/realtime/online-count` | без auth |

---

### E2E-ключи (шифрование на клиенте)

| Метод | Путь | Описание |
|-------|------|----------|
| `POST` | `/e2e-keys/backup` | Сохранить зашифрованный ключ |
| `POST` | `/e2e-keys/restore` | Восстановить |
| `GET` | `/e2e-keys/list` | Список key_id |
| `POST` | `/e2e-keys/delete` | Удалить |

Сервер хранит только **зашифрованные** blob'ы; расшифровка только на клиенте.

---

### Загрузка файлов

| Метод | Путь | Тело |
|-------|------|------|
| `POST` | `/upload/voice` | `file` (base64), `filename` |
| `POST` | `/upload/file` | `file` (base64), `filename` |
| `POST` | `/upload/video` | `file` (base64), `filename` |

Лимиты зависят от Premium-статуса пользователя.

---

## WebSocket (realtime)

Для мгновенных сообщений, групп и звонков подключайтесь к Socket.IO.

### 1. URL

Из `GET /config` → поле `websocket_url`.

### 2. Подключение (JavaScript)

```javascript
import { io } from 'socket.io-client'

const apiKey = 'YOUR_API_KEY'
const socket = io('https://webrtc.vondic.knopusmedia.ru', {
  auth: { token: apiKey },
  transports: ['websocket', 'polling'],
})

socket.on('connect', () => {
  socket.emit('authenticate', { access_token: apiKey })
})

socket.on('receive_message', (msg) => {
  console.log('Новое сообщение', msg)
})
```

### 3. Отправка

```javascript
socket.emit('send_message', {
  target_user_id: 'UUID_получателя',
  content: 'Привет из игры!',
  type: 'text',
})
```

Для группы: `group_id`. Для канала: `channel_id`.

### 4. События (основные)

| Событие | Направление | Описание |
|---------|-------------|----------|
| `authenticate` | → сервер | Авторизация (`access_token` = API-ключ или Bearer) |
| `send_message` | → сервер | Отправить сообщение |
| `receive_message` | ← сервер | Новое сообщение |
| `get_group_history` | → сервер | История группы |
| `group_history` | ← сервер | Ответ с историей |
| `logout` | → сервер | Отключение |

Полный список событий совпадает с веб-клиентом Vondic (signaling server).

---

## Форматы данных

### Сообщение

```json
{
  "id": "uuid",
  "content": "текст",
  "type": "text",
  "sender_id": "uuid",
  "target_id": "uuid",
  "group_id": null,
  "channel_id": null,
  "attachments": [],
  "reactions": [],
  "read_by": [],
  "reply_to_id": null,
  "is_edited": false,
  "is_deleted": false,
  "created_at": "2025-05-17T10:00:00",
  "updated_at": "2025-05-17T10:00:00"
}
```

---

## Коды ошибок

| HTTP | Значение |
|------|----------|
| `400` | Неверные параметры |
| `401` | Нет или неверный `api_key` / `access_token` |
| `403` | Нет доступа к чату/группе/каналу |
| `404` | Не найдено |
| `429` | Rate limit |
| `502` | Ошибка WebRTC-сервера (realtime) |

Тело ошибки:

```json
{ "error": "описание" }
```

---

## Примеры

### C# (Unity)

```csharp
using UnityEngine.Networking;

var req = UnityWebRequest.Get(
    "https://api.vondic.knopusmedia.ru/api/public/v1/chat/me");
req.SetRequestHeader("X-API-Key", apiKey);
yield return req.SendWebRequest();
```

### Python

```python
import requests

API = "https://api.vondic.knopusmedia.ru/api/public/v1/chat"
HEADERS = {"X-API-Key": "YOUR_KEY"}

r = requests.get(f"{API}/contacts/recent", headers=HEADERS)
print(r.json())

requests.post(
    f"{API}/dm/USER_ID/messages",
    headers=HEADERS,
    json={"content": "Hello from bot", "type": "text"},
)
```

### Godot (HTTPRequest)

```
headers = ["X-API-Key: YOUR_KEY", "Content-Type: application/json"]
```

---

## Связанные API

| API | URL | Назначение |
|-----|-----|------------|
| Account (ключ) | `/api/public/v1/account/api-key` | Альтернатива управлению ключом |
| OAuth | `/oauth/*` | Авторизация пользователей в вашем приложении |
| Основной REST | `/api/v1/*` | Полный функционал платформы |

---

## Безопасность

- **Не вшивайте** API-ключ в публичный клиент (браузер, APK без обфускации). Для игр храните ключ на вашем backend и проксируйте запросы.
- При компрометации: `POST /api-key` с `"rotate": true`.
- HTTPS обязателен в production.
