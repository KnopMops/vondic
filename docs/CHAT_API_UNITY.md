# Vondic Chat в Unity — полное руководство

> **Версия:** 2.0  
> **Платформы:** PC (Windows/Mac/Linux), Android, iOS, WebGL  
> **Минимальная версия Unity:** 2021.3 LTS  

---

## Содержание

1. [Что такое Vondic Chat](#1-что-такое-vondic-chat)
2. [Архитектура и поток данных](#2-архитектура-и-поток-данных)
3. [Безопасность и авторизация](#3-безопасность-и-авторизация)
4. [Необходимые пакеты](#4-необходимые-пакеты)
5. [Модели данных (C#)](#5-модели-данных-c)
6. [HTTP-клиент VondicRestClient](#6-http-клиент-vondicrestclient)
7. [WebSocket / Socket.IO клиент](#7-websocket--socketio-клиент)
8. [UI чата в Unity](#8-ui-чата-в-unity)
9. [Статический чат (клан / команда)](#9-статический-чат-клан--команда)
10. [Мультиплеерные комнаты (Lobby / Match Room)](#10-мультиплеерные-комнаты-lobby--match-room)
11. [REST-only режим (без WebSocket)](#11-rest-only-режим-без-websocket)
12. [OAuth в Unity](#12-oauth-в-unity)
13. [Публичный API — полный справочник](#13-публичный-api--полный-справочник)
14. [WebSocket события — полный справочник](#14-websocket-события--полный-справочник)
15. [Безопасность и best practices](#15-безопасность-и-best-practices)
16. [FAQ / Troubleshooting](#16-faq--troubleshooting)
17. [Чек-лист для релиза](#17-чек-лист-для-релиза)

---

## 1. Что такое Vondic Chat

**Vondic Chat** — это REST + WebSocket API для текстового чата, который можно встроить в любую Unity-игру. Поддерживает:

- **Групповые чаты** (кланы, команды, лобби)
- **Каналы** (broadcast / анонсы)
- **Личные сообщения** (DM)
- **Real-time доставка** через WebSocket (Socket.IO)
- **Историю сообщений** с пагинацией
- **Медиа-вложения** (картинки, голосовые, файлы)
- **Реакции, редактирование, удаление, цитирование, пересылка**

### Ключевое отличие от других чатов

В отличие от Firebase, Photon Chat или Mirror, Vondic Chat:
- Не требует отдельного чат-сервера в твоей инфраструктуре
- Хранит историю сообщений на своей стороне (не теряется при переподключении)
- Работает через стандартный REST + WebSocket
- Имеет веб-версию мессенджера, в которой игроки могут общаться вне игры

---

## 2. Архитектура и поток данных

### 2.1. Общая схема

```
┌─────────────────┐      OAuth / Deep Link       ┌─────────────────┐
│   Unity Client  │  ◄─────────────────────────►  │  Браузер /      │
│  (PC/Android/   │                              │  WebView        │
│   iOS/WebGL)    │                              │                 │
└────────┬────────┘                              └─────────────────┘
         │
         │  API Key / Bearer Token
         │  (получается с твоего Game Backend)
         ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Vondic REST API                            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │ /groups/... │  │ /channels...│  │ /dm/...     │             │
│  └─────────────┘  └─────────────┘  └─────────────┘             │
│                                                                 │
│  WebSocket (Socket.IO):                                         │
│  wss://webrtc.vondic.knopusmedia.ru/socket.io/                  │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2. Жизненный цикл авторизации

```
1. Игрок в Unity нажимает "Войти"
2. Открывается браузер / WebView с OAuth Vondic
3. Игрок авторизуется и получает code
4. Code отправляется на ТВОЙ Game Backend
5. Твой backend обменивает code на access_token + api_key
6. Твой backend отдаёт api_key Unity-клиенту
7. Unity использует api_key для всех запросов к Vondic
```

**Правило:** `API Key` и `access_token` **никогда** не хранятся в билде Unity. Они всегда приходят с твоего сервера после успешной авторизации.

### 2.3. Поток данных при чате

```
Отправка сообщения:
Unity ──POST /groups/{id}/messages──► Vondic REST
                                      │
                                      ▼
                              Vondic WebSocket Server
                                      │
                              broadcast receive_message
                                      │
                              ◄───────┘
                              Все участники группы
                              получают сообщение
```

---

## 3. Безопасность и авторизация

### 3.1. Три уровня доступа

| Уровень | Токен | Использование |
|---------|-------|---------------|
| **API Key** | `X-API-Key: <key>` | Публичный API для игр / ботов. Долгоиграющий. |
| **Bearer Token** | `Authorization: Bearer <token>` | Стандартный REST API для веба/мобилы. Время жизни ~1 час. |
| **Socket Token** | Передаётся через WS `authenticate` | Одноразовый токен для WebSocket-соединения. |

### 3.2. Как получить API Key

```csharp
// Твой Game Backend делает это (не Unity!)
POST https://api.vondic.knopusmedia.ru/api/public/v1/chat/api-key
Headers:
  Authorization: Bearer <access_token пользователя>

Response:
{
  "api_key": "vd_live_xxxxxxxxxxxxxxxxxxxxxxxx",
  "created_at": "2024-01-15T10:30:00Z"
}
```

### 3.3. Как получить Socket Token

```csharp
// Перед подключением к WebSocket получи токен
GET https://api.vondic.knopusmedia.ru/api/public/v1/chat/realtime/token
Headers:
  X-API-Key: <api_key>

Response:
{
  "token": "ws_xxxxxxxxxxxxxxxxxxxxxxxx",
  "expires_in": 60
}
```

> **Важно:** Socket Token живёт **60 секунд**. Запрашивай его **сразу перед** `Connect()`.

---

## 4. Необходимые пакеты

### 4.1. Newtonsoft.Json (обязательно)

`JsonUtility` из Unity **не умеет** сериализовать `Dictionary`, `List<T>` и nullable поля. Не используй его.

**Установка:**
1. `Window → Package Manager → + → Add package from git URL...`
2. Вставь: `com.unity.nuget.newtonsoft-json`

Или скачай `.tgz` с [OpenUPM](https://openupm.com/packages/jillejr.newtonsoft.json-for-unity/).

### 4.2. NativeWebSocket (опционально)

Только если хочешь WebSocket. Для REST-polling не нужен.

1. Открой [github.com/endel/NativeWebSocket](https://github.com/endel/NativeWebSocket)
2. Скачай `NativeWebSocket.unitypackage` из Releases
3. `Assets → Import Package → Custom Package...`

**Поддерживаемые платформы:** WebGL, Android, iOS, Windows, Mac, Linux.

> **Важно:** NativeWebSocket — это чистый WebSocket, а сервер Vondic использует **Socket.IO**. Для production рекомендуется найти порт `socket.io-client-csharp` для Unity. Если не хочешь заморачиваться — используй **REST polling** (см. раздел 11).

### 4.3. TextMeshPro (встроен в Unity)

`Window → TextMeshPro → Import Essential Resources`

---

## 5. Модели данных (C#)

Создай скрипт `VondicModels.cs` и помести туда все модели:

```csharp
using System;
using System.Collections.Generic;
using Newtonsoft.Json;

// ============================================================
// Пользователь
// ============================================================
[Serializable]
public class User
{
    [JsonProperty("id")] public string Id;
    [JsonProperty("username")] public string Username;
    [JsonProperty("email")] public string Email;
    [JsonProperty("avatar_url")] public string AvatarUrl;
    [JsonProperty("status")] public string Status;          // "Online", "Offline", "Away"
    [JsonProperty("role")] public string Role;              // "User", "Admin", "Support"
    [JsonProperty("premium")] public bool Premium;
    [JsonProperty("last_seen")] public DateTime? LastSeen;
}

// ============================================================
// Группа (используется как клан / команда / лобби / комната)
// ============================================================
[Serializable]
public class Group
{
    [JsonProperty("id")] public string Id;
    [JsonProperty("name")] public string Name;
    [JsonProperty("description")] public string Description;
    [JsonProperty("invite_code")] public string InviteCode;   // 8-символьный код для приглашения
    [JsonProperty("owner_id")] public string OwnerId;
    [JsonProperty("participants_count")] public int ParticipantsCount;
    [JsonProperty("created_at")] public DateTime CreatedAt;
    [JsonProperty("updated_at")] public DateTime UpdatedAt;
    
    // Полное поле participants приходит только на GET /groups/{id}
    [JsonProperty("participants")] public List<User> Participants;
}

// ============================================================
// Канал (broadcast / анонсы)
// ============================================================
[Serializable]
public class Channel
{
    [JsonProperty("id")] public string Id;
    [JsonProperty("name")] public string Name;
    [JsonProperty("description")] public string Description;
    [JsonProperty("invite_code")] public string InviteCode;
    [JsonProperty("owner_id")] public string OwnerId;
    [JsonProperty("participants_count")] public int ParticipantsCount;
}

// ============================================================
// Сообщение
// ============================================================
[Serializable]
public class Message
{
    [JsonProperty("id")] public string Id;
    [JsonProperty("content")] public string Content;
    [JsonProperty("type")] public string Type;                 // "text", "image", "voice", "file"
    [JsonProperty("sender_id")] public string SenderId;
    [JsonProperty("sender_name")] public string SenderName;      // может отсутствовать в некоторых ответах
    [JsonProperty("target_id")] public string TargetId;          // DM: ID собеседника
    [JsonProperty("group_id")] public string GroupId;            // Group chat
    [JsonProperty("channel_id")] public string ChannelId;        // Channel chat
    [JsonProperty("reply_to_id")] public string ReplyToId;       // ID сообщения, на которое отвечаем
    [JsonProperty("reply_to")] public Message ReplyTo;           // Полное цитируемое сообщение
    [JsonProperty("is_edited")] public bool IsEdited;
    [JsonProperty("is_deleted")] public bool IsDeleted;
    [JsonProperty("is_read")] public bool IsRead;                // только для DM
    [JsonProperty("created_at")] public DateTime CreatedAt;
    [JsonProperty("updated_at")] public DateTime? UpdatedAt;
    
    // Вложения (массив URL или объектов Attachment)
    [JsonProperty("attachments")] public List<Attachment> Attachments;
    [JsonProperty("reactions")] public List<Reaction> Reactions;
}

// ============================================================
// Вложение
// ============================================================
[Serializable]
public class Attachment
{
    [JsonProperty("url")] public string Url;
    [JsonProperty("name")] public string Name;
    [JsonProperty("ext")] public string Extension;
    [JsonProperty("size")] public long Size;                     // в байтах
}

// ============================================================
// Реакция
// ============================================================
[Serializable]
public class Reaction
{
    [JsonProperty("emoji")] public string Emoji;
    [JsonProperty("user_id")] public string UserId;
    [JsonProperty("created_at")] public DateTime CreatedAt;
}

// ============================================================
// Пагинация сообщений
// ============================================================
[Serializable]
public class PagedMessages
{
    [JsonProperty("items")] public List<Message> Items;
    [JsonProperty("total")] public int Total;
    [JsonProperty("page")] public int Page;
    [JsonProperty("per_page")] public int PerPage;
    [JsonProperty("next_cursor")] public string NextCursor;      // для курсорной пагинации
    [JsonProperty("has_more")] public bool HasMore;
}

// ============================================================
// API Key ответ
// ============================================================
[Serializable]
public class ApiKeyResponse
{
    [JsonProperty("api_key")] public string ApiKey;
    [JsonProperty("created_at")] public DateTime CreatedAt;
}

// ============================================================
// Socket Token ответ
// ============================================================
[Serializable]
public class SocketTokenResponse
{
    [JsonProperty("token")] public string Token;
    [JsonProperty("expires_in")] public int ExpiresIn;
}

// ============================================================
// Конфигурация сервера
// ============================================================
[Serializable]
public class ServerConfig
{
    [JsonProperty("websocket_url")] public string WebsocketUrl;
    [JsonProperty("api_version")] public string ApiVersion;
    [JsonProperty("features")] public List<string> Features;
}
```

---

## 6. HTTP-клиент VondicRestClient

Создай `VondicRestClient.cs`:

```csharp
using System;
using System.Collections;
using System.Text;
using Newtonsoft.Json;
using UnityEngine;
using UnityEngine.Networking;

/// <summary>
/// REST-клиент для Vondic Chat API.
/// Все запросы асинхронные (через корутины).
/// Поддерживает retry при ошибках сети.
/// </summary>
public class VondicRestClient : MonoBehaviour
{
    [Header("Настройки")]
    [SerializeField] private string apiKey;                         // приходит с твоего game backend
    [SerializeField] private string baseUrl = "https://api.vondic.knopusmedia.ru/api/public/v1/chat";
    [SerializeField] private int timeoutSeconds = 30;
    [SerializeField] private int maxRetries = 2;

    public void SetApiKey(string key) => apiKey = key;
    public void SetBaseUrl(string url) => baseUrl = url;

    // ============================================================
    // POST
    // ============================================================
    public IEnumerator Post<T>(string path, object body, Action<T> onSuccess, Action<string> onError)
    {
        yield return SendWithRetry<T>(UnityWebRequest.kHttpVerbPOST, path, body, onSuccess, onError);
    }

    // ============================================================
    // GET
    // ============================================================
    public IEnumerator Get<T>(string path, Action<T> onSuccess, Action<string> onError)
    {
        yield return SendWithRetry<T>(UnityWebRequest.kHttpVerbGET, path, null, onSuccess, onError);
    }

    // ============================================================
    // DELETE
    // ============================================================
    public IEnumerator Delete<T>(string path, Action<T> onSuccess, Action<string> onError)
    {
        yield return SendWithRetry<T>("DELETE", path, null, onSuccess, onError);
    }

    // ============================================================
    // PUT
    // ============================================================
    public IEnumerator Put<T>(string path, object body, Action<T> onSuccess, Action<string> onError)
    {
        yield return SendWithRetry<T>(UnityWebRequest.kHttpVerbPUT, path, body, onSuccess, onError);
    }

    // ============================================================
    // Внутренний метод с retry
    // ============================================================
    private IEnumerator SendWithRetry<T>(string method, string path, object body, Action<T> onSuccess, Action<string> onError)
    {
        int attempts = 0;
        string lastError = null;

        while (attempts <= maxRetries)
        {
            yield return SendRequest<T>(method, path, body,
                result =>
                {
                    onSuccess?.Invoke(result);
                    lastError = null; // Успех — сбрасываем ошибку
                },
                error =>
                {
                    lastError = error;
                    Debug.LogWarning($"[VondicRestClient] Попытка {attempts + 1}/{maxRetries + 1} неудачна: {error}");
                });

            if (lastError == null) yield break; // Успех

            attempts++;
            if (attempts <= maxRetries)
            {
                float delay = Mathf.Pow(2, attempts); // Exponential backoff: 2, 4, 8 сек
                Debug.Log($"[VondicRestClient] Повтор через {delay} сек...");
                yield return new WaitForSeconds(delay);
            }
        }

        onError?.Invoke(lastError);
    }

    // ============================================================
    // Базовый запрос
    // ============================================================
    private IEnumerator SendRequest<T>(string method, string path, object body, Action<T> onSuccess, Action<string> onError)
    {
        string url = baseUrl + path;
        byte[] bodyBytes = null;

        if (body != null)
        {
            string json = JsonConvert.SerializeObject(body);
            bodyBytes = Encoding.UTF8.GetBytes(json);
        }

        using var req = new UnityWebRequest(url, method);

        if (bodyBytes != null)
        {
            req.uploadHandler = new UploadHandlerRaw(bodyBytes);
        }
        req.downloadHandler = new DownloadHandlerBuffer();
        req.timeout = timeoutSeconds;

        req.SetRequestHeader("Content-Type", "application/json");
        req.SetRequestHeader("X-API-Key", apiKey);
        req.SetRequestHeader("Accept", "application/json");

        yield return req.SendWebRequest();

        if (req.result == UnityWebRequest.Result.Success)
        {
            try
            {
                T result = JsonConvert.DeserializeObject<T>(req.downloadHandler.text);
                onSuccess?.Invoke(result);
            }
            catch (Exception e)
            {
                onError?.Invoke($"Ошибка парсинга JSON: {e.Message} | Ответ: {req.downloadHandler.text}");
            }
        }
        else if (req.result == UnityWebRequest.Result.ConnectionError)
        {
            onError?.Invoke($"Ошибка соединения: {req.error}");
        }
        else if (req.result == UnityWebRequest.Result.ProtocolError)
        {
            // HTTP 4xx / 5xx
            string errorBody = req.downloadHandler.text;
            onError?.Invoke($"HTTP {req.responseCode}: {req.error} | {errorBody}");
        }
        else
        {
            onError?.Invoke($"Неизвестная ошибка: {req.error}");
        }
    }

    // ============================================================
    // Утилиты
    // ============================================================
    
    /// <summary>
    /// Получить конфигурацию сервера (WebSocket URL, версия API и т.д.)
    /// </summary>
    public IEnumerator GetConfig(Action<ServerConfig> onSuccess, Action<string> onError)
    {
        yield return Get<ServerConfig>("/config", onSuccess, onError);
    }

    /// <summary>
    /// Получить информацию о текущем пользователе
    /// </summary>
    public IEnumerator GetMe(Action<User> onSuccess, Action<string> onError)
    {
        yield return Get<User>("/me", onSuccess, onError);
    }
}
```

---

## 7. WebSocket / Socket.IO клиент

> **Важно:** Vondic использует **Socket.IO** поверх WebSocket. NativeWebSocket — это чистый WebSocket. В production рекомендуется использовать `socket.io-client-csharp` для полноценной работы. Ниже — минимальная реализация на NativeWebSocket.

Создай `VondicRealtime.cs`:

```csharp
using System;
using System.Collections;
using NativeWebSocket;
using Newtonsoft.Json;
using UnityEngine;

/// <summary>
/// WebSocket-клиент для real-time чата.
/// Использует Socket.IO Engine.IO поверх чистого WebSocket.
/// </summary>
public class VondicRealtime : MonoBehaviour
{
    [Header("Настройки")]
    [SerializeField] private string apiKey;
    [SerializeField] private string wsUrl = "wss://webrtc.vondic.knopusmedia.ru";
    [SerializeField] private bool autoReconnect = true;
    [SerializeField] private float reconnectDelay = 5f;

    private WebSocket _ws;
    private bool _isConnecting = false;
    private Coroutine _reconnectCoroutine;

    // ─── События ───
    public event Action OnConnected;
    public event Action OnDisconnected;
    public event Action<string> OnError;
    public event Action<Message> OnMessageReceived;
    public event Action<string> OnTypingStarted;   // user_id
    public event Action<string> OnTypingStopped;   // user_id
    public event Action<string, string> OnMessageRead; // user_id, message_id

    public bool IsConnected => _ws != null && _ws.State == WebSocketState.Open;

    public void SetApiKey(string key) => apiKey = key;

    // ============================================================
    // Подключение
    // ============================================================
    public async void Connect()
    {
        if (_isConnecting || IsConnected) return;
        _isConnecting = true;

        // Socket.IO требует специальный endpoint
        string fullUrl = wsUrl + "/socket.io/?EIO=4&transport=websocket";
        Debug.Log($"[VondicRealtime] Подключение к {fullUrl}");

        _ws = new WebSocket(fullUrl);

        _ws.OnOpen += () =>
        {
            _isConnecting = false;
            Debug.Log("[VondicRealtime] Подключено");

            // Авторизация через Socket.IO
            var authPayload = JsonConvert.SerializeObject(new { api_key = apiKey });
            _ws.SendText("42[\"authenticate\"," + authPayload + "]");

            OnConnected?.Invoke();
        };

        _ws.OnMessage += (bytes) =>
        {
            string text = Encoding.UTF8.GetString(bytes);
            ParseSocketMessage(text);
        };

        _ws.OnError += (err) =>
        {
            _isConnecting = false;
            Debug.LogError("[VondicRealtime] Ошибка: " + err);
            OnError?.Invoke(err);
        };

        _ws.OnClose += (e) =>
        {
            _isConnecting = false;
            Debug.Log("[VondicRealtime] Отключено: " + e);
            OnDisconnected?.Invoke();

            if (autoReconnect)
            {
                if (_reconnectCoroutine != null) StopCoroutine(_reconnectCoroutine);
                _reconnectCoroutine = StartCoroutine(ReconnectLoop());
            }
        };

        await _ws.Connect();
    }

    // ============================================================
    // Отправка сообщения в группу
    // ============================================================
    public async void SendGroupMessage(string groupId, string text, string replyToId = null)
    {
        if (!IsConnected) return;

        var payload = new
        {
            group_id = groupId,
            content = text,
            type = "text",
            reply_to = replyToId
        };
        string json = "42[\"send_message\"," + JsonConvert.SerializeObject(payload) + "]";
        await _ws.SendText(json);
    }

    // ============================================================
    // Отправка сообщения в канал
    // ============================================================
    public async void SendChannelMessage(string channelId, string text)
    {
        if (!IsConnected) return;

        var payload = new
        {
            channel_id = channelId,
            content = text,
            type = "text"
        };
        string json = "42[\"send_message\"," + JsonConvert.SerializeObject(payload) + "]";
        await _ws.SendText(json);
    }

    // ============================================================
    // Отправка личного сообщения
    // ============================================================
    public async void SendDirectMessage(string targetId, string text)
    {
        if (!IsConnected) return;

        var payload = new
        {
            target_id = targetId,
            content = text,
            type = "text"
        };
        string json = "42[\"send_message\"," + JsonConvert.SerializeObject(payload) + "]";
        await _ws.SendText(json);
    }

    // ============================================================
    // Печатает...
    // ============================================================
    public async void SendTyping(string groupId)
    {
        if (!IsConnected) return;
        string json = "42[\"typing\"," + JsonConvert.SerializeObject(new { group_id = groupId }) + "]";
        await _ws.SendText(json);
    }

    // ============================================================
    // Отметить сообщение прочитанным
    // ============================================================
    public async void MarkAsRead(string messageId)
    {
        if (!IsConnected) return;
        string json = "42[\"message_read\"," + JsonConvert.SerializeObject(new { message_id = messageId }) + "]";
        await _ws.SendText(json);
    }

    // ============================================================
    // Парсинг входящих сообщений Socket.IO
    // ============================================================
    private void ParseSocketMessage(string raw)
    {
        // Socket.IO Engine.IO пакеты начинаются с цифры:
        // 0 = open, 3 = pong, 42 = event
        if (!raw.StartsWith("42")) return;

        try
        {
            // 42["event_name",{payload}]
            int bracketStart = raw.IndexOf('[');
            if (bracketStart < 0) return;

            string payload = raw.Substring(bracketStart);
            var parsed = JsonConvert.DeserializeObject<object[]>(payload);
            if (parsed == null || parsed.Length < 1) return;

            string eventName = parsed[0]?.ToString();
            string eventData = parsed.Length > 1 ? JsonConvert.SerializeObject(parsed[1]) : null;

            switch (eventName)
            {
                case "receive_message":
                    if (eventData != null)
                    {
                        var msg = JsonConvert.DeserializeObject<Message>(eventData);
                        MainThreadDispatcher.Enqueue(() => OnMessageReceived?.Invoke(msg));
                    }
                    break;

                case "typing":
                    if (eventData != null)
                    {
                        var typingData = JsonConvert.DeserializeObject<Dictionary<string, string>>(eventData);
                        if (typingData != null && typingData.TryGetValue("user_id", out string userId))
                        {
                            MainThreadDispatcher.Enqueue(() => OnTypingStarted?.Invoke(userId));
                        }
                    }
                    break;

                case "stop_typing":
                    if (eventData != null)
                    {
                        var stopData = JsonConvert.DeserializeObject<Dictionary<string, string>>(eventData);
                        if (stopData != null && stopData.TryGetValue("user_id", out string userId))
                        {
                            MainThreadDispatcher.Enqueue(() => OnTypingStopped?.Invoke(userId));
                        }
                    }
                    break;

                case "message_read":
                    if (eventData != null)
                    {
                        var readData = JsonConvert.DeserializeObject<Dictionary<string, string>>(eventData);
                        if (readData != null)
                        {
                            readData.TryGetValue("user_id", out string userId);
                            readData.TryGetValue("message_id", out string messageId);
                            MainThreadDispatcher.Enqueue(() => OnMessageRead?.Invoke(userId, messageId));
                        }
                    }
                    break;

                case "authenticated":
                    Debug.Log("[VondicRealtime] Авторизация прошла успешно");
                    break;

                case "error":
                    Debug.LogError("[VondicRealtime] Серверная ошибка: " + eventData);
                    MainThreadDispatcher.Enqueue(() => OnError?.Invoke(eventData));
                    break;
            }
        }
        catch (Exception e)
        {
            Debug.LogError("[VondicRealtime] Ошибка парсинга: " + e.Message);
        }
    }

    // ============================================================
    // Reconnect
    // ============================================================
    private IEnumerator ReconnectLoop()
    {
        yield return new WaitForSeconds(reconnectDelay);
        Debug.Log("[VondicRealtime] Попытка переподключения...");
        Connect();
    }

    // ============================================================
    // Отключение
    // ============================================================
    public async void Disconnect()
    {
        autoReconnect = false;
        if (_reconnectCoroutine != null)
        {
            StopCoroutine(_reconnectCoroutine);
            _reconnectCoroutine = null;
        }
        if (_ws != null)
        {
            await _ws.Close();
            _ws = null;
        }
    }

    private void Update()
    {
#if !UNITY_WEBGL || UNITY_EDITOR
        _ws?.DispatchMessageQueue();
#endif
    }

    private async void OnDestroy()
    {
        Disconnect();
    }
}

/// <summary>
/// Простой диспетчер главного потока. NativeWebSocket вызывает колбеки в другом потоке.
/// </summary>
public static class MainThreadDispatcher
{
    private static readonly System.Collections.Generic.Queue<Action> _actions = new();
    private static readonly object _lock = new();

    public static void Enqueue(Action action)
    {
        lock (_lock)
        {
            _actions.Enqueue(action);
        }
    }

    [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.BeforeSceneLoad)]
    private static void Init()
    {
        var go = new GameObject("MainThreadDispatcher");
        go.AddComponent<MainThreadDispatcherRunner>();
        UnityEngine.Object.DontDestroyOnLoad(go);
    }

    private class MainThreadDispatcherRunner : MonoBehaviour
    {
        private void Update()
        {
            lock (_lock)
            {
                while (_actions.Count > 0)
                {
                    _actions.Dequeue()?.Invoke();
                }
            }
        }
    }
}
```

---

## 8. UI чата в Unity

### 8.1. Иерархия Canvas

```
Canvas (Screen Space - Overlay)
└── ChatPanel (RectTransform: anchor bottom-right, size 400x500)
    ├── Header (Image + TextMeshPro)
    │   └── RoomNameText
    ├── ScrollView (ScrollRect)
    │   ├── Viewport (Mask)
    │   │   └── Content (VerticalLayoutGroup + ContentSizeFitter)
    │   │       └── MessagePrefab (ChatMessageUI)
    │   └── Scrollbar (Vertical)
    ├── InputArea (HorizontalLayoutGroup)
    │   ├── InputField (TMP_InputField)
    │   └── SendButton (Button)
    └── TypingIndicator (TextMeshPro) // "User печатает..."
```

### 8.2. MessagePrefab

Создай префаб с именем `ChatMessage.prefab`:

```
ChatMessage (empty GameObject)
├── Avatar (Image, 32x32, rounded)
├── Content (VerticalLayoutGroup)
│   ├── SenderName (TextMeshProUGUI, bold, small)
│   └── MessageText (TextMeshProUGUI, normal)
└── TimeStamp (TextMeshProUGUI, tiny, gray)
```

### 8.3. ChatMessageUI.cs

```csharp
using TMPro;
using UnityEngine;
using UnityEngine.UI;

public class ChatMessageUI : MonoBehaviour
{
    [SerializeField] private Image avatarImage;
    [SerializeField] private TextMeshProUGUI senderNameText;
    [SerializeField] private TextMeshProUGUI messageText;
    [SerializeField] private TextMeshProUGUI timeText;
    [SerializeField] private RectTransform ownLayout;   // Layout для своих сообщений (справа)
    [SerializeField] private RectTransform otherLayout; // Layout для чужих (слева)

    public void SetMessage(string sender, string content, bool isOwn, string avatarUrl = null, string time = null)
    {
        senderNameText.text = $"<b>{sender}</b>";
        messageText.text = content;
        timeText.text = time ?? System.DateTime.Now.ToString("HH:mm");

        if (isOwn)
        {
            ownLayout.gameObject.SetActive(true);
            otherLayout.gameObject.SetActive(false);
            messageText.color = new Color(0.7f, 1f, 0.7f); // светло-зелёный
        }
        else
        {
            ownLayout.gameObject.SetActive(false);
            otherLayout.gameObject.SetActive(true);
            messageText.color = Color.white;
        }

        if (!string.IsNullOrEmpty(avatarUrl))
        {
            // Загрузка аватарки через UnityWebRequestTexture
            StartCoroutine(LoadAvatar(avatarUrl));
        }
    }

    private System.Collections.IEnumerator LoadAvatar(string url)
    {
        using var req = UnityEngine.Networking.UnityWebRequestTexture.GetTexture(url);
        yield return req.SendWebRequest();
        if (req.result == UnityEngine.Networking.UnityWebRequest.Result.Success)
        {
            var tex = UnityEngine.Networking.DownloadHandlerTexture.GetContent(req);
            avatarImage.sprite = Sprite.Create(tex, new Rect(0, 0, tex.width, tex.height), Vector2.one * 0.5f);
        }
    }
}
```

---

## 9. Статический чат (клан / команда)

Это самый простой сценарий: у игрока есть статический `groupId` (ID его клана или команды).

### 9.1. GameChatManager.cs

```csharp
using System.Collections;
using System.Collections.Generic;
using TMPro;
using UnityEngine;
using UnityEngine.UI;

/// <summary>
/// Чат для статической группы (клан / команда).
/// Использует REST polling + опционально WebSocket.
/// </summary>
public class GameChatManager : MonoBehaviour
{
    [Header("API")]
    [SerializeField] private string apiKey;
    [SerializeField] private string groupId; // ID клана, приходит с game backend

    [Header("UI")]
    [SerializeField] private Transform contentRoot;
    [SerializeField] private ChatMessageUI messagePrefab;
    [SerializeField] private TMP_InputField inputField;
    [SerializeField] private Button sendButton;
    [SerializeField] private ScrollRect scrollRect;
    [SerializeField] private TextMeshProUGUI typingIndicator;

    private VondicRestClient _rest;
    private VondicRealtime _realtime;
    private readonly HashSet<string> _displayedMessageIds = new();
    private bool _useRealtime = false;

    void Start()
    {
        _rest = gameObject.AddComponent<VondicRestClient>();
        _rest.SetApiKey(apiKey);

        // Опционально: WebSocket
        if (_useRealtime)
        {
            _realtime = gameObject.AddComponent<VondicRealtime>();
            _realtime.SetApiKey(apiKey);
            _realtime.OnMessageReceived += HandleIncomingMessage;
            _realtime.OnTypingStarted += userId => typingIndicator.text = $"{userId} печатает...";
            _realtime.OnTypingStopped += _ => typingIndicator.text = "";
            _realtime.Connect();
        }

        sendButton.onClick.AddListener(SendMessage);
        inputField.onSubmit.AddListener(_ => SendMessage());
        inputField.onValueChanged.AddListener(_ => _realtime?.SendTyping(groupId));

        // Загружаем историю
        StartCoroutine(PollHistoryLoop());
    }

    void SendMessage()
    {
        string text = inputField.text.Trim();
        if (string.IsNullOrEmpty(text)) return;

        if (_useRealtime && _realtime?.IsConnected == true)
        {
            _realtime.SendGroupMessage(groupId, text);
            inputField.text = "";
        }
        else
        {
            StartCoroutine(_rest.Post<Message>(
                $"/groups/{groupId}/messages",
                new { content = text, type = "text" },
                msg =>
                {
                    AddMessageToUI("Я", msg.Content, true);
                    inputField.text = "";
                },
                err => Debug.LogError("Ошибка отправки: " + err)
            ));
        }
    }

    void HandleIncomingMessage(Message msg)
    {
        if (_displayedMessageIds.Contains(msg.Id)) return;
        _displayedMessageIds.Add(msg.Id);

        bool isOwn = msg.SenderId == GetCurrentUserId(); // Получи ID текущего пользователя
        AddMessageToUI(msg.SenderName ?? msg.SenderId, msg.Content, isOwn);
    }

    void AddMessageToUI(string sender, string text, bool isOwn)
    {
        var go = Instantiate(messagePrefab, contentRoot);
        go.SetMessage(sender, text, isOwn);
        Canvas.ForceUpdateCanvases();
        scrollRect.verticalNormalizedPosition = 0f;
    }

    // ─── REST Polling (простая альтернатива WebSocket) ───
    IEnumerator PollHistoryLoop()
    {
        while (true)
        {
            yield return _rest.Get<PagedMessages>(
                $"/groups/{groupId}/messages?per_page=20",
                history =>
                {
                    foreach (var msg in history.Items)
                        HandleIncomingMessage(msg);
                },
                err => Debug.LogWarning("Poll error: " + err)
            );
            yield return new WaitForSeconds(5f);
        }
    }

    string GetCurrentUserId()
    {
        // Получи ID текущего пользователя из сохранённых данных
        return PlayerPrefs.GetString("vondic_user_id", "");
    }

    void OnDestroy()
    {
        _realtime?.Disconnect();
    }
}
```

---

## 10. Мультиплеерные комнаты (Lobby / Match Room)

### 10.1. Концепция

Vondic не имеет отдельной сущности «комната», но **Group** идеально подходит для лобби или матча:

| Игровая логика | Vondic Group |
|---|---|
| Создание лобби | `POST /groups` |
| Код приглашения | `invite_code` (8 символов, генерируется автоматически) |
| Игроки в лобби | `participants` |
| Чат комнаты | `POST /groups/{id}/messages` |
| Удаление истории | `DELETE /groups/{id}/history` |

### 10.2. Жизненный цикл комнаты

```
[Создание]        [Набор игроков]      [Игра]          [Завершение]
   │                   │                 │                │
   ▼                   ▼                 ▼                ▼
POST /groups    Рассылка invite_code   Чат активен   DELETE /history
   │              или POST participants   │                │
   ▼                   │                 ▼                ▼
Получаем         Игроки заходят      POST messages   Комната остаётся
invite_code      через /groups/join                     в БД (orphaned)
```

### 10.3. Модель RoomInfo

Добавь в `VondicModels.cs`:

```csharp
[Serializable]
public class RoomInfo
{
    [JsonProperty("id")] public string Id;
    [JsonProperty("name")] public string Name;
    [JsonProperty("description")] public string Description;
    [JsonProperty("invite_code")] public string InviteCode;
    [JsonProperty("owner_id")] public string OwnerId;
    [JsonProperty("participants_count")] public int ParticipantsCount;
    [JsonProperty("created_at")] public DateTime CreatedAt;
    [JsonProperty("updated_at")] public DateTime UpdatedAt;
}
```

### 10.4. Расширение VondicRestClient

Добавь в `VondicRestClient.cs`:

```csharp
// ============================================================
// Комнаты / Лобби
// ============================================================

/// <summary>
/// Создать комнату (лобби / матч).
/// </summary>
public IEnumerator CreateRoom(string roomName, string description, Action<RoomInfo> onCreated, Action<string> onError)
{
    yield return Post<RoomInfo>("/groups", new { name = roomName, description }, onCreated, onError);
}

/// <summary>
/// Войти в комнату по коду приглашения.
/// </summary>
public IEnumerator JoinRoomByCode(string inviteCode, Action<RoomInfo> onJoined, Action<string> onError)
{
    yield return Post<RoomInfo>("/groups/join", new { invite_code = inviteCode }, onJoined, onError);
}

/// <summary>
/// Добавить участника в комнату (только для владельца).
/// </summary>
public IEnumerator AddParticipant(string groupId, string userId, Action onSuccess, Action<string> onError)
{
    yield return Post<object>($"/groups/{groupId}/participants", new { user_id = userId }, _ => onSuccess?.Invoke(), onError);
}

/// <summary>
/// Получить информацию о комнате.
/// </summary>
public IEnumerator GetRoomInfo(string groupId, Action<RoomInfo> onSuccess, Action<string> onError)
{
    yield return Get<RoomInfo>($"/groups/{groupId}", onSuccess, onError);
}

/// <summary>
/// Получить список моих комнат.
/// </summary>
public IEnumerator GetMyRooms(Action<List<RoomInfo>> onSuccess, Action<string> onError)
{
    yield return Get<List<RoomInfo>>("/groups", onSuccess, onError);
}

/// <summary>
/// Очистить историю сообщений комнаты.
/// </summary>
public IEnumerator ClearRoomHistory(string groupId, Action onSuccess, Action<string> onError)
{
    yield return Delete<object>($"/groups/{groupId}/history", _ => onSuccess?.Invoke(), onError);
}
```

### 10.5. GameRoomChatManager.cs

Полный скрипт для чата внутри динамической комнаты:

```csharp
using System;
using System.Collections;
using System.Collections.Generic;
using TMPro;
using UnityEngine;
using UnityEngine.UI;

/// <summary>
/// Полноценный менеджер мультиплеерной комнаты.
/// Поддерживает создание, вход по коду, чат, историю.
/// </summary>
public class GameRoomChatManager : MonoBehaviour
{
    [Header("API")]
    [SerializeField] private string apiKey;
    [SerializeField] private string defaultRoomName = "Match Lobby";

    [Header("UI — Создание / Вход")]
    [SerializeField] private GameObject lobbyPanel;
    [SerializeField] private Button createRoomButton;
    [SerializeField] private Button joinRoomButton;
    [SerializeField] private TMP_InputField inviteCodeInput;
    [SerializeField] private TextMeshProUGUI roomInfoText;

    [Header("UI — Чат")]
    [SerializeField] private GameObject chatPanel;
    [SerializeField] private Transform contentRoot;
    [SerializeField] private ChatMessageUI messagePrefab;
    [SerializeField] private TMP_InputField inputField;
    [SerializeField] private Button sendButton;
    [SerializeField] private Button leaveRoomButton;
    [SerializeField] private ScrollRect scrollRect;
    [SerializeField] private TextMeshProUGUI typingIndicator;

    private VondicRestClient _rest;
    private VondicRealtime _realtime;
    private string _currentGroupId;
    private string _currentInviteCode;
    private string _currentUserId;
    private readonly HashSet<string> _displayedMessageIds = new();
    private Coroutine _pollCoroutine;
    private bool _useRealtime = false;

    // ─── События ───
    public event Action<RoomInfo> OnRoomCreated;
    public event Action<RoomInfo> OnRoomJoined;
    public event Action OnRoomLeft;

    void Start()
    {
        _rest = gameObject.AddComponent<VondicRestClient>();
        _rest.SetApiKey(apiKey);

        // Получаем ID текущего пользователя (сохранён после OAuth)
        _currentUserId = PlayerPrefs.GetString("vondic_user_id", "");

        createRoomButton.onClick.AddListener(CreateRoom);
        joinRoomButton.onClick.AddListener(JoinRoom);
        sendButton.onClick.AddListener(SendMessage);
        leaveRoomButton.onClick.AddListener(LeaveRoom);
        inputField.onSubmit.AddListener(_ => SendMessage());
        inputField.onValueChanged.AddListener(_ =>
        {
            if (!string.IsNullOrEmpty(_currentGroupId))
                _realtime?.SendTyping(_currentGroupId);
        });

        ShowLobbyPanel();
    }

    // ============================================================
    // Создание комнаты (хост)
    // ============================================================
    void CreateRoom()
    {
        createRoomButton.interactable = false;

        StartCoroutine(_rest.Post<RoomInfo>(
            "/groups",
            new { name = defaultRoomName, description = "Game lobby" },
            room =>
            {
                createRoomButton.interactable = true;
                _currentGroupId = room.Id;
                _currentInviteCode = room.InviteCode;
                roomInfoText.text = $"Комната: {room.Name}\nКод: {room.InviteCode}";

                Debug.Log($"[GameRoomChat] Комната создана: {room.Id}, код: {room.InviteCode}");
                OnRoomCreated?.Invoke(room);

                ShowChatPanel();
                StartChatLoop();
            },
            err =>
            {
                createRoomButton.interactable = true;
                Debug.LogError("[GameRoomChat] Ошибка создания комнаты: " + err);
            }
        ));
    }

    // ============================================================
    // Вход в комнату по коду (участник)
    // ============================================================
    void JoinRoom()
    {
        string code = inviteCodeInput.text.Trim().ToUpper();
        if (string.IsNullOrEmpty(code))
        {
            Debug.LogWarning("[GameRoomChat] Введите код приглашения");
            return;
        }

        joinRoomButton.interactable = false;

        StartCoroutine(_rest.Post<RoomInfo>(
            "/groups/join",
            new { invite_code = code },
            room =>
            {
                joinRoomButton.interactable = true;
                _currentGroupId = room.Id;
                _currentInviteCode = room.InviteCode;
                roomInfoText.text = $"Комната: {room.Name}";

                Debug.Log($"[GameRoomChat] Вошли в комнату: {room.Id}");
                OnRoomJoined?.Invoke(room);

                ShowChatPanel();
                StartChatLoop();
            },
            err =>
            {
                joinRoomButton.interactable = true;
                Debug.LogError("[GameRoomChat] Ошибка входа в комнату: " + err);
            }
        ));
    }

    // ============================================================
    // Отправка сообщения
    // ============================================================
    void SendMessage()
    {
        string text = inputField.text.Trim();
        if (string.IsNullOrEmpty(text) || string.IsNullOrEmpty(_currentGroupId)) return;

        if (_useRealtime && _realtime?.IsConnected == true)
        {
            _realtime.SendGroupMessage(_currentGroupId, text);
            inputField.text = "";
        }
        else
        {
            StartCoroutine(_rest.Post<Message>(
                $"/groups/{_currentGroupId}/messages",
                new { content = text, type = "text" },
                msg =>
                {
                    HandleIncomingMessage(msg);
                    inputField.text = "";
                },
                err => Debug.LogError("[GameRoomChat] Ошибка отправки: " + err)
            ));
        }
    }

    // ============================================================
    // Выход из комнаты
    // ============================================================
    void LeaveRoom()
    {
        if (_pollCoroutine != null)
        {
            StopCoroutine(_pollCoroutine);
            _pollCoroutine = null;
        }

        _realtime?.Disconnect();
        _displayedMessageIds.Clear();
        _currentGroupId = null;
        _currentInviteCode = null;

        // Очистить UI
        foreach (Transform child in contentRoot)
            Destroy(child.gameObject);

        OnRoomLeft?.Invoke();
        ShowLobbyPanel();
    }

    // ============================================================
    // Получение сообщений
    // ============================================================
    void HandleIncomingMessage(Message msg)
    {
        if (msg == null) return;
        if (_displayedMessageIds.Contains(msg.Id)) return;
        _displayedMessageIds.Add(msg.Id);

        bool isOwn = msg.SenderId == _currentUserId;
        string senderName = msg.SenderName ?? msg.SenderId;
        string time = msg.CreatedAt.ToString("HH:mm");

        AddMessageToUI(senderName, msg.Content, isOwn, time);
    }

    void AddMessageToUI(string sender, string text, bool isOwn, string time = null)
    {
        var go = Instantiate(messagePrefab, contentRoot);
        go.SetMessage(sender, text, isOwn, null, time);
        Canvas.ForceUpdateCanvases();
        scrollRect.verticalNormalizedPosition = 0f;
    }

    // ============================================================
    // Запуск чат-цикла (polling или WebSocket)
    // ============================================================
    void StartChatLoop()
    {
        if (_useRealtime)
        {
            _realtime = gameObject.AddComponent<VondicRealtime>();
            _realtime.SetApiKey(apiKey);
            _realtime.OnMessageReceived += HandleIncomingMessage;
            _realtime.OnTypingStarted += userId => typingIndicator.text = $"{userId} печатает...";
            _realtime.OnTypingStopped += _ => typingIndicator.text = "";
            _realtime.Connect();
        }

        if (_pollCoroutine != null) StopCoroutine(_pollCoroutine);
        _pollCoroutine = StartCoroutine(PollHistoryLoop());
    }

    // ─── REST Polling ───
    IEnumerator PollHistoryLoop()
    {
        while (!string.IsNullOrEmpty(_currentGroupId))
        {
            yield return _rest.Get<PagedMessages>(
                $"/groups/{_currentGroupId}/messages?per_page=50",
                history =>
                {
                    foreach (var msg in history.Items)
                        HandleIncomingMessage(msg);
                },
                err => Debug.LogWarning("[GameRoomChat] Poll error: " + err)
            );
            yield return new WaitForSeconds(3f);
        }
    }

    // ============================================================
    // UI переключение
    // ============================================================
    void ShowLobbyPanel()
    {
        lobbyPanel.SetActive(true);
        chatPanel.SetActive(false);
    }

    void ShowChatPanel()
    {
        lobbyPanel.SetActive(false);
        chatPanel.SetActive(true);
    }

    void OnDestroy()
    {
        _realtime?.Disconnect();
    }
}
```

---

## 11. REST-only режим (без WebSocket)

Если не хочешь заморачиваться с Socket.IO / WebSocket — используй **REST polling** с курсорной пагинацией:

```csharp
// Продвинутый polling с курсорами (не перегружает сервер)
public class RestPollingChat : MonoBehaviour
{
    [SerializeField] private string apiKey;
    [SerializeField] private string groupId;
    [SerializeField] private float pollInterval = 3f;

    private VondicRestClient _rest;
    private string _lastCursor;
    private readonly HashSet<string> _knownIds = new();

    void Start()
    {
        _rest = gameObject.AddComponent<VondicRestClient>();
        _rest.SetApiKey(apiKey);
        StartCoroutine(PollLoop());
    }

    IEnumerator PollLoop()
    {
        while (true)
        {
            string url = $"/groups/{groupId}/messages?per_page=20";
            if (!string.IsNullOrEmpty(_lastCursor))
                url += $"&cursor={UnityWebRequest.EscapeURL(_lastCursor)}";

            yield return _rest.Get<PagedMessages>(url, history =>
            {
                if (history.Items.Count > 0)
                {
                    _lastCursor = history.NextCursor;

                    foreach (var msg in history.Items)
                    {
                        if (_knownIds.Add(msg.Id))
                        {
                            // Новое сообщение
                            Debug.Log($"[{msg.SenderName}]: {msg.Content}");
                        }
                    }
                }
            }, err => { });

            yield return new WaitForSeconds(pollInterval);
        }
    }
}
```

### Плюсы и минусы polling

| | Polling | WebSocket |
|---|---|---|
| **Задержка** | 3–5 секунд | Мгновенно |
| **Нагрузка на сервер** | Средняя | Низкая |
| **Сложность** | Очень низкая | Средняя |
| **Батарея (мобилы)** | Тратит больше | Экономичнее |
| **Рекомендация** | Прототипы, кланы до 50 чел | ММО, real-time игры |

---

## 12. OAuth в Unity

### 12.1. Получение OAuth URL

```csharp
string BuildAuthUrl(string clientId, string redirectUri)
{
    return $"https://vondic.knopusmedia.ru/oauth/authorize?" +
           $"client_id={UnityWebRequest.EscapeURL(clientId)}&" +
           $"redirect_uri={UnityWebRequest.EscapeURL(redirectUri)}&" +
           $"response_type=code&" +
           $"state={Guid.NewGuid()}";
}
```

### 12.2. Standalone (PC/Mac)

```csharp
// Регистрируешь кастомный URI в системе (mygame://oauth)
// Или используешь localhost + HttpListener

#if UNITY_STANDALONE
using System.Net;

public class OAuthListener : MonoBehaviour
{
    private HttpListener _listener;

    void Start()
    {
        _listener = new HttpListener();
        _listener.Prefixes.Add("http://localhost:8080/oauth/callback/");
        _listener.Start();
        _listener.BeginGetContext(OnRequest, null);
    }

    void OnRequest(IAsyncResult result)
    {
        var context = _listener.EndGetContext(result);
        string code = context.Request.QueryString["code"];

        // Отправь code на свой Game Backend
        StartCoroutine(SendCodeToBackend(code));

        // Ответ браузеру
        var response = context.Response;
        string responseString = "<html><body>Авторизация успешна! Можно закрыть окно.</body></html>";
        byte[] buffer = Encoding.UTF8.GetBytes(responseString);
        response.ContentLength64 = buffer.Length;
        response.OutputStream.Write(buffer, 0, buffer.Length);
        response.Close();
    }

    void OnDestroy()
    {
        _listener?.Stop();
    }
}
#endif
```

### 12.3. Android (Deep Link)

В `AndroidManifest.xml` добавь:

```xml
<activity android:name="com.unity3d.player.UnityPlayerActivity">
    <intent-filter>
        <action android:name="android.intent.action.VIEW" />
        <category android:name="android.intent.category.DEFAULT" />
        <category android:name="android.intent.category.BROWSABLE" />
        <data android:scheme="mygame" android:host="oauth" />
    </intent-filter>
</activity>
```

В Unity:

```csharp
void OnApplicationFocus(bool focus)
{
    if (!focus) return;
    string url = Application.absoluteURL;
    if (url.Contains("code="))
    {
        string code = ExtractCode(url);
        StartCoroutine(SendCodeToBackend(code));
    }
}
```

### 12.4. iOS (URL Scheme)

В `Info.plist`:

```xml
<key>CFBundleURLTypes</key>
<array>
    <dict>
        <key>CFBundleURLName</key>
        <string>com.yourcompany.mygame</string>
        <key>CFBundleURLSchemes</key>
        <array>
            <string>mygame</string>
        </array>
    </dict>
</array>
```

### 12.5. WebGL

Используй `jslib` плагин:

```javascript
// Plugins/WebGL/OAuthCallback.jslib
mergeInto(LibraryManager.library, {
    InitOAuthCallback: function() {
        window.addEventListener('message', function(e) {
            if (e.data.type === 'vondic_oauth_code') {
                // Отправить в Unity
                var bufferSize = lengthBytesUTF8(e.data.code) + 1;
                var buffer = _malloc(bufferSize);
                stringToUTF8(e.data.code, buffer, bufferSize);
                Module.dynCall_vi($0, buffer);
            }
        });
    }
});
```

---

## 13. Публичный API — полный справочник

Базовый URL: `https://api.vondic.knopusmedia.ru/api/public/v1/chat`

### Auth

| Method | Path | Body | Описание |
|--------|------|------|----------|
| `POST` | `/auth/token` | `{ "code": "...", "client_id": "...", "client_secret": "..." }` | Обмен OAuth code на access_token |
| `GET` | `/api-key` | — | Получить API Key текущего пользователя |
| `POST` | `/api-key` | — | Сгенерировать новый API Key |
| `GET` | `/me` | — | Информация о текущем пользователе |
| `GET` | `/config` | — | Конфигурация сервера (WebSocket URL и т.д.) |

### Groups (Комнаты / Кланы)

| Method | Path | Body | Описание |
|--------|------|------|----------|
| `POST` | `/groups` | `{ "name": "...", "description": "..." }` | Создать группу |
| `GET` | `/groups` | — | Список моих групп |
| `GET` | `/groups/{id}` | — | Информация о группе |
| `POST` | `/groups/join` | `{ "invite_code": "..." }` | Войти по коду |
| `GET` | `/groups/{id}/participants` | — | Список участников |
| `POST` | `/groups/{id}/participants` | `{ "user_id": "..." }` | Добавить участника |
| `GET` | `/groups/{id}/messages` | Query: `per_page`, `cursor` | История сообщений |
| `POST` | `/groups/{id}/messages` | `{ "content": "...", "type": "text" }` | Отправить сообщение |
| `DELETE` | `/groups/{id}/messages/{msg_id}` | — | Удалить сообщение |
| `DELETE` | `/groups/{id}/history` | — | Очистить историю |

### Channels

| Method | Path | Описание |
|--------|------|----------|
| `POST` | `/channels` | Создать канал |
| `GET` | `/channels` | Список моих каналов |
| `GET` | `/channels/{id}` | Информация о канале |
| `POST` | `/channels/join` | Войти в канал |
| `GET` | `/channels/{id}/messages` | История |
| `POST` | `/channels/{id}/messages` | Отправить |

### Direct Messages (DM)

| Method | Path | Описание |
|--------|------|----------|
| `GET` | `/contacts/recent` | Недавние контакты |
| `GET` | `/dm/{target_id}/messages` | История DM |
| `POST` | `/dm/{target_id}/messages` | Отправить DM |
| `DELETE` | `/dm/{target_id}/messages/{msg_id}` | Удалить |
| `DELETE` | `/dm/{target_id}/history` | Очистить историю |

### Presence

| Method | Path | Body | Описание |
|--------|------|------|----------|
| `POST` | `/presence` | `{ "status": "online" }` | Установить статус |

### Upload

| Method | Path | Описание |
|--------|------|----------|
| `POST` | `/upload/file` | Загрузить файл |
| `POST` | `/upload/voice` | Загрузить голосовое |
| `POST` | `/upload/video` | Загрузить видео |

---

## 14. WebSocket события — полный справочник

### Исходящие (от Unity к серверу)

| Событие | Payload | Описание |
|---------|---------|----------|
| `authenticate` | `{ "api_key": "..." }` | Авторизация при подключении |
| `send_message` | `{ "group_id" \| "channel_id" \| "target_id", "content", "type" }` | Отправка сообщения |
| `typing` | `{ "group_id": "..." }` | Начал печатать |
| `stop_typing` | `{ "group_id": "..." }` | Закончил печатать |
| `message_read` | `{ "message_id": "..." }` | Прочитал сообщение |
| `join_group` | `{ "group_id": "..." }` | Подписаться на группу |
| `leave_group` | `{ "group_id": "..." }` | Отписаться |

### Входящие (от сервера к Unity)

| Событие | Payload | Описание |
|---------|---------|----------|
| `authenticated` | `{}` | Успешная авторизация |
| `receive_message` | `Message` | Новое сообщение |
| `typing` | `{ "user_id": "...", "group_id": "..." }` | Кто-то печатает |
| `stop_typing` | `{ "user_id": "...", "group_id": "..." }` | Кто-то закончил |
| `message_read` | `{ "user_id": "...", "message_id": "..." }` | Сообщение прочитано |
| `message_edited` | `{ "message_id": "...", "content": "..." }` | Сообщение отредактировано |
| `message_deleted` | `{ "message_id": "..." }` | Сообщение удалено |
| `user_joined` | `{ "group_id": "...", "user_id": "..." }` | Новый участник |
| `user_left` | `{ "group_id": "...", "user_id": "..." }` | Участник вышел |
| `error` | `{ "message": "..." }` | Ошибка |

---

## 15. Безопасность и best practices

### ❌ НЕ делай

- Не храни `API Key`, `client_secret` или `access_token` в билде Unity
- Не используй HTTP вместо HTTPS (кроме localhost для OAuth callback)
- Не отправляй `client_secret` из Unity — только с твоего Game Backend
- Не доверяй `sender_id` на клиенте — валидируй на сервере

### ✅ Делай

- Храни `API Key` в `PlayerPrefs` или зашифрованном хранилище
- Используй TLS 1.2+ (`UnityWebRequest` делает это по умолчанию)
- Проверяй `responseCode` на 401/403 и перезапрашивай токен
- Лимитируй частоту сообщений (rate limit) на клиенте
- Очищай чат-историю при выходе из комнаты

---

## 16. FAQ / Troubleshooting

### Q: Сообщения не приходят в реальном времени
A: Убедись, что:
1. WebSocket подключён (`_ws.State == Open`)
2. Отправил `authenticate` после `OnOpen`
3. Используешь правильный URL: `wss://webrtc.vondic.knopusmedia.ru/socket.io/?EIO=4&transport=websocket`
4. На WebGL используешь `DispatchMessageQueue()` в `Update()`

### Q: HTTP 401 Unauthorized
A: API Key невалиден или истёк. Запроси новый через `/api-key` или перезапусти OAuth flow.

### Q: HTTP 403 Forbidden
A: Пользователь не является участником группы. Вызови `POST /groups/join` с `invite_code`.

### Q: Сообщения дублируются в UI
A: Используй `HashSet<string>` для `_displayedMessageIds` и проверяй перед добавлением.

### Q: WebSocket не работает на WebGL
A: NativeWebSocket требует специальной обработки для WebGL. Убедись, что:
- В `Update()` вызывается `_ws.DispatchMessageQueue()`
- Используешь последнюю версию NativeWebSocket
- Для WebGL проще использовать REST polling

### Q: Как узнать ID текущего пользователя?
A: Вызови `GET /me` и сохрани `id` в `PlayerPrefs`.

### Q: Можно ли отправлять картинки?
A: Да. Загрузи файл через `POST /upload/file`, получи URL, отправь сообщение с `type = "image"` и `attachments = [{ "url": "..." }]`. В данном руководстве это не рассмотрено подробно — обратись к API docs.

---

## 17. Чек-лист для релиза

| Платформа | Что проверить |
|-----------|---------------|
| **Android** | `INTERNET` permission в `AndroidManifest.xml` |
| **Android** | `android:usesCleartextTraffic="false"` (только HTTPS) |
| **iOS** | `App Transport Security` → разрешить HTTPS |
| **iOS** | URL Scheme зарегистрирован в `Info.plist` |
| **WebGL** | CORS настроен на твоём Game Backend |
| **WebGL** | `UnityWebRequest` вместо `HttpClient` |
| **Все** | `API Key` не в билде → приходит с сервера |
| **Все** | Обработка 401/403 с рефрешем токена |
| **Все** | Rate limit на отправку сообщений |
| **Все** | Очистка чат-истории при выходе из комнаты |

---

## Файлы, которые нужно создать

```
Assets/
├── Scripts/
│   ├── VondicModels.cs            // Все модели данных
│   ├── VondicRestClient.cs        // HTTP клиент с retry
│   ├── VondicRealtime.cs          // WebSocket / Socket.IO клиент
│   ├── MainThreadDispatcher.cs    // Диспетчер главного потока (внутри VondicRealtime.cs)
│   ├── GameChatManager.cs         // Статический чат (клан)
│   ├── GameRoomChatManager.cs     // Динамический чат (лобби / комната)
│   ├── RestPollingChat.cs         // Пример polling без WebSocket
│   └── UI/
│       ├── ChatMessageUI.cs       // UI элемента сообщения
│       └── ChatUIManager.cs       // Опционально: управление всем UI чата
├── Prefabs/
│   └── ChatMessage.prefab         // Префаб сообщения
└── Plugins/                        // Если используешь NativeWebSocket
    └── NativeWebSocket/
```

---

> Если нужно — могу собрать готовый `.unitypackage`, дописать пример с **корутинами вместо async/await** (для Unity 2019), или добавить поддержку **голосовых сообщений** и **вложений**.
