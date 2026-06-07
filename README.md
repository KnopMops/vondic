<div align="center">
  <img src="frontend/src/app/favicon.ico" width="96" height="96" alt="Vondic" />
  <h2>Vondic</h2>
  <p>Коммуникационная платформа: чаты, сообщества, голосовые каналы и WebRTC‑звонки.</p>
</div>

---

## 🎯 Что внутри

Vondic — моно‑репозиторий с несколькими сервисами (веб‑клиент, API, WebRTC‑сигналинг, бот и инфраструктура). Основной способ запуска для разработки/стенда — через `docker-compose.yml`.

---

## 🧱 Структура репозитория

| Модуль | Назначение | Путь |
| --- | --- | --- |
| Frontend | Next.js веб‑клиент | `frontend/` |
| Backend | Flask API, доменная логика | `backend/` |
| WebRTC | сигналинг/звонки | `webrtc/` |
| Bot | сервис бота | `bot/` |
| Nginx | reverse‑proxy/SSL | `nginx/` |
| Static Nginx | раздача `uploads`/static | `nginx-static/` |
| PgBouncer | пул соединений Postgres | `pgbouncer/` |
| Botik SDK | SDK для ботов | `botiksdk/` |
| (прочее) | экспериментальные/вспомогательные модули | `support-api/`, `proxy_receiver/`, `video_checker/`, `extension/`, `test/` |

---

## 🚀 Быстрый старт (Docker Compose)

### Требования

- Docker + Docker Compose v2

### 1) Подготовить `.env` файлы

`docker-compose.yml` ожидает реальные файлы (не `.example`):

```bash
cp backend/.env.backend.example backend/.env.backend
cp webrtc/.env.webrtc.example webrtc/.env.webrtc
cp bot/.env.bot.example bot/.env.bot
cp frontend/.env.example frontend/.env
```

### 2) Запуск

```bash
docker compose up -d --build
```

### 3) Проверка портов

- **Frontend**: `http://localhost:3000`
- **Backend API**: `http://localhost:5050`
- **WebRTC service**: `http://localhost:5000`
- **Static files**: `http://localhost:8080`
- **Nginx**: `http://localhost` и `https://localhost` (если настроен SSL)
- **RabbitMQ UI**: `http://localhost:15672`
- **Postgres**: `localhost:5432`
- **PgBouncer**: `localhost:6432`
- **Redis**: `localhost:6379`

Остановить:

```bash
docker compose down
```

---

## 🔐 Важное про TURN / WebRTC

В `docker-compose.yml` сервис `turn` (coturn) запускается с параметрами прямо в `command`. Для реального окружения **обязательно вынесите креды/realm/external‑ip в переменные окружения** и не храните секреты в открытом виде.

Также убедитесь, что:

- в `turn` корректно указан `--external-ip` (публичный IP/1:1 NAT),
- проброшены UDP порты (см. `50000-50050`),
- домен/realm совпадает с окружением.

---

## 🧑‍💻 Локальная разработка (без Docker)

Если нужно поднимать сервисы по отдельности:

### Frontend

```bash
cd frontend
bun install
bun run dev
```

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python run.py
```

### WebRTC

```bash
cd webrtc
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python main.py
```

---

## 📚 Документация и ссылки

- **Botik SDK**: `https://vondic.ru/api-docs`
- **OAuth заметки**: `https://vondic.ru/api-docs`
- **README по модулям**:
  - `frontend/README.md`
  - `backend/README.md`
  - `webrtc/README.md`
  - `bot/README.md`

<a href="LICENSE">
  <img src="https://img.shields.io/badge/License-CC%20BY--NC%20ND%204.0-lightgrey?style=for-the-badge&labelColor=red&color=darkred" alt="License: Non-Commercial Only">
</a>
<a href="LICENSE">
  <img src="https://img.shields.io/badge/Commercial%20Use-Not%20Allowed-red?style=for-the-badge" alt="Commercial Use: Not Allowed">
</a>
<a href="LICENSE">
  <img src="https://img.shields.io/badge/Open%20Source-Yes-brightgreen?style=for-the-badge" alt="Open Source: Yes">
</a>
