import html
from datetime import datetime

from app.core.extensions import db
from app.models.group import Group
from app.models.message import Message
from app.models.user import User
from sqlalchemy import or_


class MessageService:
    @staticmethod
    def _sanitize_text(value):
        if value is None:
            return None
        if not isinstance(value, str):
            value = str(value)
        return html.escape(value.strip(), quote=True)

    @staticmethod
    def create_message(data, user_id, group_id=None, target_id=None):
        content = data.get("content")
        attachments = data.get("attachments")
        msg_type = data.get("type", "text")

        if attachments is not None and not isinstance(attachments, list):
            return None, "attachments must be a list"

        if not content and not attachments:
            return None, "Content or attachments is required"

        if not content:
            content = ""
        else:
            content = MessageService._sanitize_text(content)

        if group_id:
            group = Group.query.get(group_id)
            if not group:
                return None, "Group not found"

            user = User.query.get(user_id)
            if not user or user not in group.participants:
                return None, "User is not a participant of this group"

            new_message = Message(
                content=content,
                attachments=attachments,
                type=msg_type,
                sender_id=user_id,
                group_id=group_id,
                is_deleted=False
            )
        elif target_id:
            target_user = User.query.get(target_id)
            if not target_user:
                return None, "Target user not found"

            new_message = Message(
                content=content,
                attachments=attachments,
                type=msg_type,
                sender_id=user_id,
                target_id=target_id,
            )
        else:
            return None, "Either group_id or target_id is required"

        try:
            db.session.add(new_message)
            db.session.commit()

            from app.services.ollama_service import AI_USERNAME, OllamaService

            if group_id:
                ai_participant = next(
                    (p for p in group.participants if p.username == AI_USERNAME), None)
                if ai_participant and str(new_message.sender_id) != str(
                    ai_participant.id
                ):
                    OllamaService.process_message_async(
                        new_message.id, is_dm=False)

            elif target_id:
                ai_user = OllamaService.get_ai_user()
                if str(target_id) == str(ai_user.id):
                    OllamaService.process_message_async(
                        new_message.id, is_dm=True)

            return new_message, None
        except Exception as e:
            db.session.rollback()
            return None, str(e)

    @staticmethod
    def get_direct_messages(
            user_id,
            target_id,
            page=1,
            per_page=50,
            cursor=None):
        query = Message.query.filter(
            ((Message.sender_id == user_id) & (
                Message.target_id == target_id)) | (
                (Message.sender_id == target_id) & (
                    Message.target_id == user_id)))

        if cursor:
            try:
                cursor_dt = datetime.fromisoformat(cursor)
                query = query.filter(Message.created_at < cursor_dt)
            except ValueError:
                pass

        messages = query.order_by(Message.created_at.desc()).paginate(
            page=page, per_page=per_page, error_out=False
        )

        return messages, None

    @staticmethod
    def get_group_messages(
            group_id,
            user_id,
            page=1,
            per_page=50,
            cursor=None):
        group = Group.query.get(group_id)
        if not group:
            return None, "Group not found"

        user = User.query.get(user_id)
        if not user or user not in group.participants:
            return None, "Access denied"

        query = Message.query.filter_by(group_id=group_id)

        if cursor:
            try:
                cursor_dt = datetime.fromisoformat(cursor)
                query = query.filter(Message.created_at < cursor_dt)
            except ValueError:
                pass

        messages = query.order_by(Message.created_at.desc()).paginate(
            page=page, per_page=per_page, error_out=False
        )

        return messages, None

    @staticmethod
    def get_recent_contacts(user_id, limit=30):
        try:
            query = Message.query.filter(
                Message.group_id.is_(None), Message.target_id.isnot(None), or_(
                    Message.sender_id == user_id, Message.target_id == user_id), ).order_by(
                Message.created_at.desc())
            messages = query.limit(max(limit * 5, limit)).all()
            seen = {}
            last_payload_by_user = {}
            ordered = []
            for msg in messages:
                other_id = (
                    msg.target_id if str(msg.sender_id) == str(
                        user_id) else msg.sender_id
                )
                if not other_id or str(other_id) == str(user_id):
                    continue
                other_id_str = str(other_id)
                if other_id_str in seen:
                    continue
                seen[other_id_str] = msg.created_at
                content = (msg.content or "").strip()
                if msg.type == "voice":
                    preview = "🎤 Голосовое сообщение"
                elif msg.type == "image":
                    preview = "🖼️ Фото"
                elif msg.type == "file":
                    preview = "📎 Файл"
                else:
                    preview = content
                last_payload_by_user[other_id_str] = {
                    "last_message_text": preview,
                    "last_message_type": msg.type or "text",
                }
                ordered.append(other_id_str)
                if len(ordered) >= limit:
                    break
            if not ordered:
                return []
            users = User.query.filter(User.id.in_(ordered)).all()
            users_map = {str(u.id): u for u in users}
            result = []
            for uid in ordered:
                user = users_map.get(uid)
                if not user:
                    continue
                data = user.to_dict()
                last_at = seen.get(uid)
                if last_at:
                    data["last_message_at"] = last_at.isoformat()
                payload = last_payload_by_user.get(uid) or {}
                if payload.get("last_message_text"):
                    data["last_message_text"] = payload["last_message_text"]
                if payload.get("last_message_type"):
                    data["last_message_type"] = payload["last_message_type"]
                result.append(data)
            return result
        except Exception as e:
            print(f"Error in get_recent_contacts: {e}")
            import traceback
            traceback.print_exc()
            return []
