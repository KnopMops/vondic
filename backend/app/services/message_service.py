from datetime import datetime

from app.core.extensions import db
from app.models.group import Group
from app.models.message import Message
from app.models.user import User


class MessageService:
    @staticmethod
    def create_message(data, user_id, group_id):
        content = data.get("content")
        attachments = data.get("attachments")
        msg_type = data.get("type", "text")

        if attachments is not None and not isinstance(attachments, list):
            return None, "attachments must be a list"

        if not content and not attachments:
            return None, "Content or attachments is required"

        if not content:
            content = ""

        group = Group.query.get(group_id)
        if not group:
            return None, "Group not found"

        # Check if user is participant
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

        try:
            db.session.add(new_message)
            db.session.commit()
            return new_message, None
        except Exception as e:
            db.session.rollback()
            return None, str(e)

    @staticmethod
    def get_group_messages(group_id, user_id, page=1, per_page=50, cursor=None):
        group = Group.query.get(group_id)
        if not group:
            return None, "Group not found"

        # Check access
        user = User.query.get(user_id)
        if not user or user not in group.participants:
            return None, "Access denied"

        query = Message.query.filter_by(group_id=group_id)

        if cursor:
            try:
                # Ensure cursor is in correct format or convert if needed
                # Assuming cursor is an ISO format string
                cursor_dt = datetime.fromisoformat(cursor)
                query = query.filter(Message.created_at < cursor_dt)
            except ValueError:
                pass  # Ignore invalid cursor

        messages = query.order_by(Message.created_at.desc())\
            .paginate(page=page, per_page=per_page, error_out=False)

        return messages, None
