import html
from datetime import datetime

from app.core.extensions import db
from app.models.group import Group
from app.models.message import Message
from app.models.user import User


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
                group_id=group_id
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
                target_id=target_id
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
                if ai_participant and str(new_message.sender_id) != str(ai_participant.id):
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
    def get_direct_messages(user_id, target_id, page=1, per_page=50, cursor=None):
        query = Message.query.filter(
            ((Message.sender_id == user_id) & (Message.target_id == target_id)) |
            ((Message.sender_id == target_id) & (Message.target_id == user_id))
        )

        if cursor:
            try:
                cursor_dt = datetime.fromisoformat(cursor)
                query = query.filter(Message.created_at < cursor_dt)
            except ValueError:
                pass

        messages = query.order_by(Message.created_at.desc())\
            .paginate(page=page, per_page=per_page, error_out=False)

        return messages, None

    @staticmethod
    def get_group_messages(group_id, user_id, page=1, per_page=50, cursor=None):
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

        messages = query.order_by(Message.created_at.desc())\
            .paginate(page=page, per_page=per_page, error_out=False)

        return messages, None
