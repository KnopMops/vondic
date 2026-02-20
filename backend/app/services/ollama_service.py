import logging
import threading
import time
from datetime import datetime

import requests
from app.core.config import Config
from app.core.extensions import db
from app.models.message import Message
from app.models.user import User

AI_USERNAME = "Vondic AI"
AI_EMAIL = "ai@vondic.com"
logger = logging.getLogger(__name__)


class OllamaService:
    @staticmethod
    def get_ai_user():
        user = User.query.filter_by(username=AI_USERNAME).first()
        if not user:
            old_user = User.query.filter_by(username="vondic_ai").first()
            if old_user:
                old_user.username = AI_USERNAME
                db.session.commit()
                return old_user

            user = User(
                username=AI_USERNAME,
                email=AI_EMAIL,
                role="Bot",
                is_verified=1,
                status="online",
                avatar_url="/static/vondic_ai.jpg"
            )
            user.set_password("ai_secret_password_very_long")
            db.session.add(user)
            db.session.commit()
        if user.avatar_url != "/static/vondic_ai.jpg":
            user.avatar_url = "/static/vondic_ai.jpg"
            db.session.commit()
        return user

    @staticmethod
    def ensure_chat_with_ai(user_id):
        pass

    @staticmethod
    def _support_faq_answer(text):
        t = (text or "").strip().casefold()
        if not t:
            return None
        if "yandex" in t or "яндекс" in t:
            if "войти" in t or "вход" in t or "авториза" in t or "логин" in t:
                return (
                    "На странице входа нажмите «Войти через Yandex» и подтвердите вход. "
                    "После этого вас автоматически перенаправит в ленту (/feed). "
                    "Если окно авторизации не открылось — обновите страницу и попробуйте ещё раз."
                )
        if "двухфактор" in t or "2fa" in t or "two factor" in t or "код" in t:
            if "где" in t and ("код" in t or "2fa" in t or "two factor" in t):
                return (
                    "После запроса 2FA на странице входа появится поле «Two Factor Code». "
                    "Введите шестизначный код из письма."
                )
            if "почему" in t or "просят" in t or "ввести" in t:
                return (
                    "Это двухфакторная защита (2FA). Нажмите «Отправить код на почту», "
                    "откройте письмо и введите шестизначный код."
                )
            if "не приходит" in t or "не приш" in t or "письмо" in t or "почт" in t:
                return (
                    "Проверьте «Спам» и «Промоакции». Убедитесь, что адрес почты указан верно. "
                    "Нажмите «Отправить код на почту» ещё раз. Если проблема сохраняется — напишите в поддержку."
                )
        return None

    @staticmethod
    def _send_reply(reply_content, ai_user, reply_target_id, reply_group_id, is_dm, message_id):
        reply_msg = Message(
            content=reply_content,
            type="text",
            sender_id=ai_user.id,
            target_id=reply_target_id,
            group_id=reply_group_id
        )
        db.session.add(reply_msg)
        db.session.commit()

        try:
            signaling_url = "http://localhost:5000/internal/broadcast_message"
            payload = {
                "id": str(reply_msg.id),
                "sender_id": str(ai_user.id),
                "content": reply_content,
                "type": "text",
                "timestamp": reply_msg.created_at.isoformat() if reply_msg.created_at else datetime.utcnow().isoformat(),
                "is_read": 0
            }

            if is_dm:
                payload["target_id"] = str(reply_target_id)
                broadcast_data = {
                    "target_id": str(reply_target_id),
                    "payload": payload
                }
            else:
                payload["group_id"] = str(reply_group_id)
                broadcast_data = {
                    "group_id": str(reply_group_id),
                    "payload": payload
                }

            requests.post(
                signaling_url, json=broadcast_data, timeout=5)
        except Exception as e:
            logger.exception(
                "ai_signal_error message_id=%s error=%s",
                message_id,
                e,
            )

    @staticmethod
    def process_message_async(message_id, is_dm=True, content=None, sender_id=None):
        logger.info(
            "ai_start message_id=%s is_dm=%s sender_id=%s",
            message_id,
            is_dm,
            sender_id,
        )
        thread = threading.Thread(
            target=OllamaService._generate_reply, args=(message_id, is_dm, content, sender_id))
        thread.start()

    @staticmethod
    def _generate_reply(message_id, is_dm=True, content=None, sender_id=None):
        from app import create_app
        app = create_app()
        with app.app_context():
            message = Message.query.get(message_id)
            if not message and not content:
                logger.warning("ai_skip_no_message message_id=%s", message_id)
                return

            user_content = content if content else (
                message.content if message else None)
            if not user_content:
                logger.warning("ai_skip_no_content message_id=%s", message_id)
                return

            reply_target_id = None
            reply_group_id = None

            if is_dm:
                reply_target_id = sender_id if sender_id else (
                    message.sender_id if message else None)
            else:
                reply_group_id = message.group_id if message else None

            if is_dm and not reply_target_id:
                logger.warning("ai_skip_no_target message_id=%s", message_id)
                return

            ai_user = OllamaService.get_ai_user()

            system_prompt = (
                "Ты — Vondic AI, созданный компанией Vondic. "
                "Всегда отвечай на русском языке. "
                "Ты помогаешь пользователям с функционалом и интерфейсом Vondic. "
                "Знаешь базовые возможности: лента, посты, комментарии, реакции, друзья, чаты, группы, каналы, "
                "ответы на сообщения, пересылка, закреп, поиск, профиль, настройки, уведомления, поддержка. "
                "Давай краткие пошаговые решения, опираясь на интерфейс и функции фронтенда. "
                "Если вопрос общий, отвечай вежливо и по делу. "
                "Не упоминай, что ты ИИ, если тебя не спрашивают. Будь кратким."
            )

            payload = {
                "model": Config.OLLAMA_MODEL,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_content}
                ],
                "stream": False
            }

            try:
                support_answer = OllamaService._support_faq_answer(
                    user_content)
                if support_answer:
                    OllamaService._send_reply(
                        support_answer,
                        ai_user,
                        reply_target_id,
                        reply_group_id,
                        is_dm,
                        message_id,
                    )
                    return
                started = time.perf_counter()
                logger.info(
                    "ai_request_start message_id=%s url=%s",
                    message_id,
                    f"{Config.OLLAMA_API_URL}/api/chat",
                )
                response = requests.post(
                    f"{Config.OLLAMA_API_URL}/api/chat", json=payload, timeout=60)
                elapsed = time.perf_counter() - started
                logger.info(
                    "ai_request_done message_id=%s status=%s elapsed=%.3fs",
                    message_id,
                    response.status_code,
                    elapsed,
                )
                response.raise_for_status()
                result = response.json()
                reply_content = result.get("message", {}).get("content", "")

                if reply_content:
                    OllamaService._send_reply(
                        reply_content,
                        ai_user,
                        reply_target_id,
                        reply_group_id,
                        is_dm,
                        message_id,
                    )
            except Exception as e:
                logger.exception(
                    "ai_request_error message_id=%s error=%s",
                    message_id,
                    e,
                )
