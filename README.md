# Vondic

<div align="center">
  <img src="frontend/src/app/favicon.ico" width="96" height="96" alt="Vondic Botik" />
  <h3>Коммуникационная платформа с чатами, сообществами и WebRTC‑звонками</h3>
  <p>
    <img src="https://img.shields.io/badge/Next.js-16.1.6-000000?style=for-the-badge&logo=next.js" />
    <img src="https://img.shields.io/badge/Flask-3.0.3-0A0A0A?style=for-the-badge&logo=flask" />
    <img src="https://img.shields.io/badge/Socket.IO-4.8.3-1d1d1d?style=for-the-badge&logo=socket.io" />
    <img src="https://img.shields.io/badge/WebRTC-Real--time-7b2cbf?style=for-the-badge" />
  </p>
</div>

---

## ✨ О проекте

Vondic — модульная экосистема с веб‑клиентом, бэкендом, WebRTC‑сигналингом, бот‑SDK и вспомогательными сервисами. Поддерживает личные чаты, группы, сообщества, голосовые каналы и расширяемую инфраструктуру.

---

## 🧩 Компоненты

| Модуль         | Назначение                     | Путь              |
| -------------- | ------------------------------ | ----------------- |
| Frontend       | Next.js веб‑клиент             | `frontend/`       |
| Backend        | Flask API и доменная логика    | `backend/`        |
| WebRTC         | Сигналинг и звонки             | `webrtc/`         |
| Proxy Receiver | TCP‑прокси и защищённые каналы | `proxy_receiver/` |
| Support API    | RAG/поддержка                  | `support-api/`    |
| Video Checker  | Асинхронные проверки           | `video_checker/`  |
| Bot            | Сервис бота                    | `bot/`            |
| Botik SDK      | SDK для ботов                  | `botiksdk/`       |
| Extension      | Расширение браузера            | `extension/`      |

---

## 🌈 Основные возможности

- Личные сообщения, группы и сообщества
- Текстовые и голосовые каналы
- WebRTC‑звонки и демонстрация экрана
- Поддержка ботов и SDK
- Прокси‑модуль для защищённого трафика
- Инструменты модерации и поддержки

---

## 🚀 Быстрый старт

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
python -m app
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

## 🔐 Конфигурация

Каждый модуль использует собственные `.env` или параметры запуска.
Рекомендуется начать с:

- `backend/.env.backend.example`
- `webrtc/.env.webrtc.example`
- `bot/.env.bot.example`
- `frontend/.env.example`

---

## 🎨 Визуальные материалы

<p>
  <img src="frontend/static/gifts/star.png" width="72" alt="Star" />
  <img src="frontend/static/gifts/crown.png" width="72" alt="Crown" />
  <img src="frontend/static/gifts/firework.png" width="72" alt="Firework" />
</p>

---

## 📦 Сборка

```bash
cd frontend
bun run build
```

---

## 📌 Полезные ссылки

- Web клиент: `frontend/`
- API: `backend/`
- WebRTC: `webrtc/`
- Bot: `bot/`
- Proxy Receiver: `proxy_receiver/`
