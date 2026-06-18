# Vondic Chat API — интеграция на C# (для игр)

Руководство по встраиванию мессенджера Vondic в игру на C# (Unity, Godot Mono или standalone-сервер).

**Базовый URL REST:** `https://api.vondic.ru/api/public/v1/chat`  
**Базовый URL OAuth:** `https://vondic.ru/oauth`  
**WebSocket (realtime):** `https://webrtc.vondic.ru` (Socket.IO)

---

## Содержание

1. [Архитектура игрового чата](#архитектура-игрового-чата)
2. [Авторизация: OAuth → API Key](#авторизация-oauth--api-key)
3. [HTTP-клиент (REST)](#http-клиент-rest)
4. [Модели данных (C#)](#модели-данных-c)
5. [Отправка и чтение сообщений](#отправка-и-чтение-сообщений)
6. [Группы (кланы/лобби)](#группы-кланылобби)
7. [WebSocket (realtime)](#websocket-realtime)
8. [Полный пример: консольный клиент](#полный-пример-консольный-клиент)

---

## Архитектура игрового чата

```
┌─────────────┐      OAuth code      ┌──────────────────┐
│   Игрок     │ ───────────────────► │  Игровой сервер  │
│  (клиент)   │                      │      (C#)        │
└─────────────┘                      └────────┬─────────┘
       ▲                                      │
       │                              exchange code → access_token → api_key
       │                                      │
       │   API Key / Bearer                   ▼
       └─────────────────────────────►  Vondic REST + WS
```

**Правило:** API Key никогда не хранится в клиенте игры. Игрок проходит OAuth, ваш сервер меняет `code` на `access_token`, получает `api_key` и привязывает его к аккаунту игрока в вашей БД. Дальше клиент общается с вашим сервером, а ваш сервер — с Vondic.

---

## Авторизация: OAuth → API Key

### Шаг 1 — Получение OAuth Client

Зарегистрируй приложение в Vondic: **Profile Settings → Developer Settings → Create Application**. Сохрани `client_id` и `client_secret` (показывается один раз).

### Шаг 2 — Редирект на авторизацию

Сформируй URL и открой его в браузере игрока (или внутриигровой WebView):

```
https://vondic.ru/oauth/authorize?
  client_id={CLIENT_ID}&
  redirect_uri={REDIRECT_URI}&
  response_type=code&
  state={RANDOM_STATE}
```

| Параметр | Описание |
|----------|----------|
| `client_id` | ID приложения |
| `redirect_uri` | Должен точно совпадать с тем, что указан в настройках приложения |
| `response_type` | Всегда `code` |
| `state` | Случайная строка для защиты от CSRF (проверь при возврате) |

### Шаг 3 — Обмен code на access_token

После согласия пользователя Vondic редиректит на:

```
{REDIRECT_URI}?code=AUTHORIZATION_CODE&state=RANDOM_STATE
```

Твой сервер обменивает `code` на токен:

```csharp
using System.Net.Http;
using System.Text.Json;

async Task<string> ExchangeCodeAsync(string code, string state)
{
    var data = new Dictionary<string, string>
    {
        ["grant_type"] = "authorization_code",
        ["code"] = code,
        ["redirect_uri"] = "https://yourgame.com/oauth/callback",
        ["client_id"] = "your_client_id",
        ["client_secret"] = "your_client_secret"
    };

    var resp = await _http.PostAsync(
        "https://vondic.ru/oauth/token",
        new FormUrlEncodedContent(data));

    resp.EnsureSuccessStatusCode();
    var json = JsonDocument.Parse(await resp.Content.ReadAsStringAsync());
    return json.RootElement.GetProperty("access_token").GetString();
}
```

### Шаг 4 — Получение API Key

API Key — это "вечный" секрет для Chat API. Получается один раз и хранится в твоей БД:

```csharp
async Task<string> GetApiKeyAsync(string accessToken)
{
    var request = new HttpRequestMessage(
        HttpMethod.Post,
        "https://api.vondic.ru/api/public/v1/chat/api-key");
    request.Headers.Authorization =
        new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", accessToken);

    var resp = await _http.SendAsync(request);
    resp.EnsureSuccessStatusCode();
    var json = JsonDocument.Parse(await resp.Content.ReadAsStringAsync());
    return json.RootElement.GetProperty("api_key").GetString();
}
```

> Повторный вызов вернёт тот же ключ. Чтобы перевыпустить: `POST …/api-key` с телом `{"rotate":true}`.

### Шаг 5 — Использование

Все запросы к Chat API несут заголовок:

```
X-API-Key: {api_key}
```

---

## HTTP-клиент (REST)

Рекомендуется создать обёртку:

```csharp
public class VondicChatClient : IDisposable
{
    private readonly HttpClient _http;
    private readonly string _baseUrl;
    private readonly string _apiKey;

    public VondicChatClient(string apiKey, string baseUrl = "https://api.vondic.ru/api/public/v1/chat")
    {
        _apiKey = apiKey;
        _baseUrl = baseUrl.TrimEnd('/');
        _http = new HttpClient();
        _http.DefaultRequestHeaders.Add("X-API-Key", _apiKey);
    }

    private async Task<T> PostAsync<T>(string path, object body)
    {
        var json = JsonSerializer.Serialize(body);
        var resp = await _http.PostAsync(
            $"{_baseUrl}{path}",
            new StringContent(json, Encoding.UTF8, "application/json"));
        resp.EnsureSuccessStatusCode();
        return JsonSerializer.Deserialize<T>(
            await resp.Content.ReadAsStringAsync(),
            new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
    }

    private async Task<T> GetAsync<T>(string path)
    {
        var resp = await _http.GetAsync($"{_baseUrl}{path}");
        resp.EnsureSuccessStatusCode();
        return JsonSerializer.Deserialize<T>(
            await resp.Content.ReadAsStringAsync(),
            new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
    }

    public void Dispose() => _http?.Dispose();
}
```

---

## Модели данных (C#)

```csharp
using System;
using System.Collections.Generic;
using System.Text.Json.Serialization;

public record User
{
    [JsonPropertyName("id")] public string Id { get; init; }
    [JsonPropertyName("username")] public string Username { get; init; }
    [JsonPropertyName("avatar_url")] public string AvatarUrl { get; init; }
    [JsonPropertyName("status")] public string Status { get; init; }
}

public record Group
{
    [JsonPropertyName("id")] public string Id { get; init; }
    [JsonPropertyName("name")] public string Name { get; init; }
    [JsonPropertyName("description")] public string Description { get; init; }
    [JsonPropertyName("invite_code")] public string InviteCode { get; init; }
    [JsonPropertyName("owner_id")] public string OwnerId { get; init; }
    [JsonPropertyName("participants")] public List<User> Participants { get; init; }
}

public record Message
{
    [JsonPropertyName("id")] public string Id { get; init; }
    [JsonPropertyName("content")] public string Content { get; init; }
    [JsonPropertyName("type")] public string Type { get; init; } // text, image, voice, file
    [JsonPropertyName("sender_id")] public string SenderId { get; init; }
    [JsonPropertyName("target_id")] public string TargetId { get; init; }
    [JsonPropertyName("group_id")] public string GroupId { get; init; }
    [JsonPropertyName("channel_id")] public string ChannelId { get; init; }
    [JsonPropertyName("attachments")] public List<Attachment> Attachments { get; init; }
    [JsonPropertyName("reactions")] public List<Reaction> Reactions { get; init; }
    [JsonPropertyName("reply_to_id")] public string ReplyToId { get; init; }
    [JsonPropertyName("is_edited")] public bool IsEdited { get; init; }
    [JsonPropertyName("is_deleted")] public bool IsDeleted { get; init; }
    [JsonPropertyName("created_at")] public DateTime CreatedAt { get; init; }
}

public record Attachment
{
    [JsonPropertyName("url")] public string Url { get; init; }
    [JsonPropertyName("name")] public string Name { get; init; }
}

public record Reaction
{
    [JsonPropertyName("user_id")] public string UserId { get; init; }
    [JsonPropertyName("username")] public string Username { get; init; }
    [JsonPropertyName("emoji")] public string Emoji { get; init; }
}

public record PagedMessages
{
    [JsonPropertyName("items")] public List<Message> Items { get; init; }
    [JsonPropertyName("total")] public int Total { get; init; }
    [JsonPropertyName("pages")] public int Pages { get; init; }
    [JsonPropertyName("page")] public int Page { get; init; }
    [JsonPropertyName("next_cursor")] public string NextCursor { get; init; }
}
```

---

## Отправка и чтение сообщений

### Личное сообщение (DM)

```csharp
// Отправка
var msg = await client.PostAsync<Message>(
    $"/dm/{targetUserId}/messages",
    new { content = "Привет из игры!", type = "text" });

// История
var history = await client.GetAsync<PagedMessages>(
    $"/dm/{targetUserId}/messages?per_page=50");
```

### Групповой чат (клан / лобби)

```csharp
// Отправка в группу
var msg = await client.PostAsync<Message>(
    $"/groups/{groupId}/messages",
    new { content = "Всем привет!", type = "text" });

// История группы
var history = await client.GetAsync<PagedMessages>(
    $"/groups/{groupId}/messages?per_page=50");
```

### Реакции, редактирование, удаление

```csharp
// Реакция
await client.PostAsync<object>($"/messages/{msgId}/reaction", new { emoji = "👍" });

// Редактировать (до 48 часов)
await _http.PutAsJsonAsync(
    $"{_baseUrl}/messages/{msgId}/edit",
    new { content = "Исправленный текст" });

// Удалить для всех (до 7 суток)
await _http.PostAsJsonAsync(
    $"{_baseUrl}/messages/{msgId}/delete-for-everyone",
    new { });
```

---

## Группы (кланы/лобби)

### Создать группу

```csharp
var group = await client.PostAsync<Group>("/groups", new
{
    name = "Клан Огня",
    description = "PvP-клан для рейдов по выходным"
});
// group.InviteCode — код для приглашения
```

### Вступить по invite_code

```csharp
var joined = await client.PostAsync<Group>("/groups/join", new
{
    invite_code = "abc12345"
});
```

### Добавить участника по username

```csharp
var updated = await client.PostAsync<Group>(
    $"/groups/{groupId}/participants",
    new { username = "ivan_petrov" });
```

> Добавлять может любой текущий участник группы (не только владелец).

### Список моих групп

```csharp
var myGroups = await client.GetAsync<List<Group>>("/groups");
```

---

## WebSocket (realtime)

Для мгновенной доставки сообщений подключайся к Socket.IO-серверу.

### URL

Берётся из `GET /config` → `websocket_url`:

```csharp
var config = await client.GetAsync<JsonElement>("/config");
var wsUrl = config.GetProperty("websocket_url").GetString(); // https://webrtc...
```

### NuGet-пакеты

```xml
<PackageReference Include="SocketIOClient" Version="3.1.1" />
<PackageReference Include="SocketIOClient.Newtonsoft.Json" Version="3.1.1" />
```

### Подключение и авторизация

```csharp
using SocketIOClient;
using SocketIOClient.Transport;

var socket = new SocketIO(wsUrl, new SocketIOOptions
{
    Transport = TransportProtocol.WebSocket,
    ExtraHeaders = new Dictionary<string, string>
    {
        ["X-API-Key"] = _apiKey
    }
});

socket.OnConnected += (sender, e) =>
{
    Console.WriteLine("WS подключён");
    socket.EmitAsync("authenticate", new { access_token = _apiKey });
};

socket.On("receive_message", response =>
{
    var msg = response.GetValue<Message>();
    Console.WriteLine($"[{msg.SenderId}]: {msg.Content}");
});

await socket.ConnectAsync();
```

### Отправка через WebSocket

```csharp
await socket.EmitAsync("send_message", new
{
    group_id = "uuid-группы",
    content = "Атакуем через 5 минут!",
    type = "text"
});
```

### Основные события

| Событие | Направление | Описание |
|---------|-------------|----------|
| `authenticate` | → сервер | Авторизация после подключения |
| `send_message` | → сервер | Отправить сообщение |
| `receive_message` | ← сервер | Новое сообщение |
| `get_group_history` | → сервер | Запросить историю группы |
| `group_history` | ← сервер | Ответ с историей |
| `logout` | → сервер | Отключиться |

> Если Socket.IO не подходит, можно опрашивать REST каждые 2–5 секунд через `GET /contacts/recent` или `GET /groups/{id}/messages?cursor=...`.

---

## Полный пример: консольный клиент

```csharp
using System;
using System.Net.Http;
using System.Net.Http.Json;
using System.Text.Json;
using System.Threading.Tasks;

class GameChatClient
{
    private readonly HttpClient _http = new();
    private readonly string _baseUrl;
    private readonly string _apiKey;

    public GameChatClient(string apiKey)
    {
        _apiKey = apiKey;
        _baseUrl = "https://api.vondic.ru/api/public/v1/chat";
        _http.DefaultRequestHeaders.Add("X-API-Key", _apiKey);
    }

    public async Task<User> GetMeAsync()
    {
        return await _http.GetFromJsonAsync<User>($"{_baseUrl}/me");
    }

    public async Task<Group> CreateGroupAsync(string name)
    {
        var resp = await _http.PostAsJsonAsync($"{_baseUrl}/groups", new { name });
        resp.EnsureSuccessStatusCode();
        return JsonSerializer.Deserialize<Group>(
            await resp.Content.ReadAsStringAsync(),
            new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
    }

    public async Task<Message> SendGroupMessageAsync(string groupId, string text)
    {
        var resp = await _http.PostAsJsonAsync(
            $"{_baseUrl}/groups/{groupId}/messages",
            new { content = text, type = "text" });
        resp.EnsureSuccessStatusCode();
        return JsonSerializer.Deserialize<Message>(
            await resp.Content.ReadAsStringAsync(),
            new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
    }

    public async Task<PagedMessages> GetGroupHistoryAsync(string groupId)
    {
        return await _http.GetFromJsonAsync<PagedMessages>(
            $"{_baseUrl}/groups/{groupId}/messages?per_page=50");
    }
}

class Program
{
    static async Task Main(string[] args)
    {
        // 1. Получи API Key через OAuth (см. раздел выше)
        var apiKey = "YOUR_PLAYER_API_KEY";

        var chat = new GameChatClient(apiKey);

        // 2. Кто я
        var me = await chat.GetMeAsync();
        Console.WriteLine($"Игрок: {me.Username} ({me.Id})");

        // 3. Создать клан (или используй существующий groupId)
        var group = await chat.CreateGroupAsync("Клан C#");
        Console.WriteLine($"Группа создана: {group.Name} (invite: {group.InviteCode})");

        // 4. Отправить сообщение
        var msg = await chat.SendGroupMessageAsync(group.Id, "Всем привет из C#!");
        Console.WriteLine($"Отправлено: {msg.Content}");

        // 5. История
        var history = await chat.GetGroupHistoryAsync(group.Id);
        foreach (var m in history.Items)
        {
            Console.WriteLine($"[{m.CreatedAt:HH:mm}] {m.SenderId}: {m.Content}");
        }
    }
}
```

---

## Полезные напоминания

| | |
|---|---|
| **HTTPS** | Всегда используй HTTPS в production. |
| **API Key** | Храни на сервере игры. Никогда не вшивай в клиент. |
| **Rate limits** | При превышении лимита — HTTP 429. Делай exponential backoff. |
| **Типы сообщений** | `text`, `image`, `file`, `voice`. Для загрузки файлов используй `/upload/file`. |
| **E2E** | Если нужно end-to-end шифрование — используй endpoints `/e2e-keys/*`. |

---

## Связанные документы

- [OAuth 2.0](OAUTH_EN.md) — полный flow регистрации приложений и токенов
- [Chat API (общее)](CHAT_API_RU.md) — описание всех endpoints
- [BotikSDK](BOTIKSDK_EN.md) — Python SDK для ботов

---

**Последнее обновление:** May 2026
