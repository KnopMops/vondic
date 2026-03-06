# Библиотека клиента API Vondic

Python-библиотека для взаимодействия с публичным API социальной сети Vondic.

## Установка

```bash
pip install vondic-api  # После публикации в PyPI
```

Или установите из исходников:

```bash
pip install -e .
```

## Быстрый старт

```python
from vondic_api import VondicClient

# Инициализируйте клиент с вашим API-ключом
client = VondicClient(api_key="your_api_key_here")

# Получить текущего пользователя
current_user = client.get_current_user()
print(f"Привет, {current_user.username}!")

# Получить все посты
posts = client.get_posts(limit=10)
for post in posts:
    print(f"{post.user.username}: {post.content}")

# Создать новый пост
new_post = client.create_post(
    content="Привет из клиентской библиотеки Vondic API!",
    privacy="public"
)
print(f"Создан пост с ID: {new_post.id}")

# Отправить сообщение
message = client.send_message(
    recipient_id="recipient_user_id",
    content="Привет!"
)
print(f"Отправлено сообщение с ID: {message.id}")
```

## Возможности

- **Управление пользователями**: Получение, обновление, подписка/отписка пользователей
- **Управление постами**: Создание, чтение, обновление, удаление постов
- **Обмен сообщениями**: Отправка и получение сообщений
- **Комментарии**: Создание, чтение, обновление, удаление комментариев
- **Лайки**: Лайкать/дизлайкать посты и комментарии
- **Аутентификация**: Безопасная аутентификация на основе API-ключа
- **Ограничение частоты запросов**: Автоматическая обработка ограничений

## Обрабатываемые точки API

### Пользователи
- `GET /users` - Получить всех пользователей
- `GET /users/{user_id}` - Получить конкретного пользователя
- `GET /users/me` - Получить текущего пользователя
- `PUT /users/me` - Обновить текущего пользователя
- `POST /users/{user_id}/follow` - Подписаться на пользователя
- `POST /users/{user_id}/unfollow` - Отписаться от пользователя

### Посты
- `GET /posts` - Получить все посты
- `GET /posts/{post_id}` - Получить конкретный пост
- `POST /posts` - Создать пост
- `PUT /posts/{post_id}` - Обновить пост
- `DELETE /posts/{post_id}` - Удалить пост
- `POST /posts/{post_id}/like` - Поставить лайк посту
- `POST /posts/{post_id}/unlike` - Убрать лайк с поста

### Сообщения
- `GET /messages` - Получить сообщения
- `POST /messages` - Отправить сообщение
- `GET /messages/threads` - Получить переписки

### Комментарии
- `GET /comments/post/{post_id}` - Получить комментарии к посту
- `POST /comments` - Создать комментарий
- `PUT /comments/{comment_id}` - Обновить комментарий
- `DELETE /comments/{comment_id}` - Удалить комментарий
- `POST /comments/{comment_id}/like` - Поставить лайк комментарию
- `POST /comments/{comment_id}/unlike` - Убрать лайк с комментария

## Обработка ошибок

Библиотека вызывает специфические исключения для различных условий ошибок:

- `AuthenticationError` - Когда API-ключ недействителен или просрочен
- `RateLimitError` - Когда превышено ограничение частоты запросов
- `ValidationError` - Когда не проходит проверка запроса
- `VondicAPIException` - Для других ошибок API

Пример обработки ошибок:

```python
from vondic_api import VondicClient, AuthenticationError, VondicAPIException

client = VondicClient(api_key="your_api_key_here")

try:
    user = client.get_current_user()
except AuthenticationError:
    print("Неверный API-ключ")
except VondicAPIException as e:
    print(f"Ошибка API: {e.message}")
```

## Ограничение частоты запросов

Клиент автоматически обрабатывает информацию об ограничении частоты запросов из API:

```python
client = VondicClient(api_key="your_api_key_here")

# После выполнения запроса
print(f"Осталось запросов: {client.rate_limit_remaining}")
print(f"Время сброса: {client.rate_limit_reset}")
```

## Вклад в развитие

1. Сделайте форк репозитория
2. Создайте ветку функции
3. Внесите свои изменения
4. Добавьте тесты, если применимо
5. Отправьте запрос на слияние

## Лицензия

MIT License