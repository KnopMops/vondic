import threading
from datetime import datetime

import requests
from app.core.config import Config
from app.core.extensions import db
from app.models.message import Message
from app.models.user import User

AI_USERNAME = "Vondic AI"
AI_EMAIL = "ai@vondic.com"


class OllamaService:
    @staticmethod
    def get_ai_user():
        user = User.query.filter_by(username=AI_USERNAME).first()
        if not user:
            # Check if old username exists and rename it
            old_user = User.query.filter_by(username="vondic_ai").first()
            if old_user:
                old_user.username = AI_USERNAME
                db.session.commit()
                return old_user

            # Create AI user if not exists
            user = User(
                username=AI_USERNAME,
                email=AI_EMAIL,
                role="Bot",
                is_verified=1,
                status="online",
                avatar_url="https://ui-avatars.com/api/?name=Vondic+AI&background=0D8ABC&color=fff"
            )
            user.set_password("ai_secret_password_very_long")
            db.session.add(user)
            db.session.commit()
        return user

    @staticmethod
    def ensure_chat_with_ai(user_id):
        # This is now a no-op as we use Direct Messages
        pass

    @staticmethod
    def process_message_async(message_id, is_dm=True, content=None, sender_id=None):
        """
        Starts a background thread to process the message
        """
        thread = threading.Thread(
            target=OllamaService._generate_reply, args=(message_id, is_dm, content, sender_id))
        thread.start()

    @staticmethod
    def _generate_reply(message_id, is_dm=True, content=None, sender_id=None):
        from app import create_app
        app = create_app()
        with app.app_context():
            message = Message.query.get(message_id)
            # If message is not in DB yet (rare but possible with async), we use content if provided
            if not message and not content:
                return

            user_content = content if content else (
                message.content if message else None)
            if not user_content:
                return

            # Determine who to reply to
            reply_target_id = None
            reply_group_id = None

            if is_dm:
                reply_target_id = sender_id if sender_id else (
                    message.sender_id if message else None)
            else:
                reply_group_id = message.group_id if message else None

            if is_dm and not reply_target_id:
                return

            ai_user = OllamaService.get_ai_user()

            # System prompt to classify and answer
            system_prompt = (
                "You are Vondic AI, a helpful assistant in the Vondic messenger. "
                "Your goal is to assist users. "
                "IMPORTANT RULE: If the user asks about technical issues, bugs, errors, or how to use specific features of THIS service (Vondic), "
                "you MUST reply ONLY with: 'Пожалуйста, обратитесь в техническую поддержку для решения этого вопроса.' "
                "(Translate to the user's language if needed, but keep the meaning). "
                "If the user asks general questions (e.g., programming, life, math, chit-chat), answer them helpfully and politely. "
                "Do not mention you are an AI unless asked. Be concise."
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
                print(
                    f"Sending request to Ollama: {Config.OLLAMA_API_URL}/api/chat")
                response = requests.post(
                    f"{Config.OLLAMA_API_URL}/api/chat", json=payload, timeout=60)
                print(f"Ollama response status: {response.status_code}")
                response.raise_for_status()
                result = response.json()
                reply_content = result.get("message", {}).get("content", "")

                if reply_content:
                    # Save reply to DB
                    reply_msg = Message(
                        content=reply_content,
                        type="text",
                        sender_id=ai_user.id,
                        target_id=reply_target_id,
                        group_id=reply_group_id
                    )
                    db.session.add(reply_msg)
                    db.session.commit()

                    # Notify signaling server for real-time update
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
                        print(f"Error notifying signaling server: {e}")
            except Exception as e:
                print(f"Ollama error: {e}")
                # Optionally send error message to user
