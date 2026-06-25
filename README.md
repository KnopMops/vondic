<div align="center">
  <img src="frontend/src/app/favicon.ico" width="96" height="96" alt="Vondic" />
  <h2>Vondic</h2>
  <p>Коммуникационная платформа: чаты, сообщества, голосовые каналы и WebRTC‑звонки.</p>
</div>

<a href="LICENSE">
  <img src="https://img.shields.io/badge/License-CC%20BY--NC%20ND%204.0-lightgrey?style=for-the-badge&labelColor=red&color=darkred" alt="License: Non-Commercial Only">
</a>
<a href="LICENSE">
  <img src="https://img.shields.io/badge/Commercial%20Use-Not%20Allowed-red?style=for-the-badge" alt="Commercial Use: Not Allowed">
</a>
<a href="LICENSE">
  <img src="https://img.shields.io/badge/Open%20Source-Yes-brightgreen?style=for-the-badge" alt="Open Source: Yes">
</a>

---

## 🎯 Что внутри

Вондик (Vondic) — убийца Вконтакте с открытым исходным кодом.

---

## 🧱 Структура репозитория

| Модуль | Назначение | Путь |
| --- | --- | --- |
| Frontend | Next.js веб‑клиент | `frontend/` |
| Backend | Flask API, доменная логика | `backend/` |
| WebRTC | сигналинг/звонки | `webrtc/` |
| Bot | сервис бота | `bot/` |
| Botik SDK | SDK для ботов | `botiksdk/` |
| (прочее) | экспериментальные/вспомогательные модули | `support-api/`, `proxy_receiver/`, `video_checker/`, `extension/`, `test/` |

---

## 📚 Документация и ссылки

- **Botik SDK**: `https://vondic.ru/api-docs` + `https://pypi.org/project/botiksdk/`
- **OAuth заметки**: `https://vondic.ru/api-docs`
- **README по модулям**:
  - `frontend/README.md`
  - `backend/README.md`
  - `webrtc/README.md`
  - `bot/README.md`
