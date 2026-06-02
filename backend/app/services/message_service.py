import html
from datetime import datetime

from app.core.extensions import db
from app.models.group import Group
from app.models.message import Message
from app.models.user import User
from app.services.user_service import UserService
from app.utils.mtproto_crypto import mtproto_decrypt
from sqlalchemy import case, func, or_


class MessageService:
    @staticmethod
    def _sanitize_text(value):
        if value is None:
            return None
        if not isinstance(value, str):
            value = str(value)
        return html.escape(value.strip(), quote=False)

    @staticmethod
    def _decrypt_content(value: str | None) -> str | None:
        if not value:
            return value
        decrypted = mtproto_decrypt(value)
        return decrypted if decrypted is not None else value

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

            if UserService.is_blocked(str(target_id), str(user_id)):
                return None, "Пользователь заблокировал вас, отправка сообщений недоступна"
            if UserService.is_blocked(str(user_id), str(target_id)):
                return None, "Вы заблокировали этого пользователя, отправка сообщений недоступна"

            new_message = Message(
                content=content,
                attachments=attachments,
                type=msg_type,
                sender_id=user_id,
                target_id=target_id,
                reply_to_id=data.get("reply_to_id"),
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
    def create_channel_message(data, user_id, channel_id):
        from app.models.channel import Channel

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

        channel = Channel.query.get(channel_id)
        if not channel:
            return None, "Channel not found"

        user = User.query.get(user_id)
        if not user or user not in channel.participants:
            return None, "User is not a participant of this channel"

        # Broadcast channels: only owner can post text; participants can send voice only
        if channel.type == "broadcast" and str(channel.owner_id) != str(user_id):
            if msg_type != "voice":
                return None, "Only owner can post text in this channel. Voice messages allowed."

        new_message = Message(
            content=content,
            attachments=attachments,
            type=msg_type,
            sender_id=user_id,
            channel_id=channel_id,
            reply_to_id=data.get("reply_to_id"),
            is_deleted=False,
        )

        try:
            db.session.add(new_message)
            db.session.commit()
            return new_message, None
        except Exception as e:
            db.session.rollback()
            return None, str(e)

    @staticmethod
    def get_channel_messages(
            channel_id,
            user_id,
            page=1,
            per_page=50,
            cursor=None):
        from app.models.channel import Channel

        channel = Channel.query.get(channel_id)
        if not channel:
            return None, "Channel not found"

        user = User.query.get(user_id)
        if not user or user not in channel.participants:
            return None, "Access denied"

        query = Message.query.filter_by(channel_id=channel_id)

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
    def user_can_access_message(user_id, message):
        uid = str(user_id)
        if str(message.sender_id) == uid:
            return True
        if message.target_id and (
            str(message.target_id) == uid or str(message.sender_id) == uid
        ):
            return True
        if message.group_id:
            group = Group.query.get(message.group_id)
            if group:
                user = User.query.get(user_id)
                return user and user in group.participants
        if message.channel_id:
            from app.models.channel import Channel

            channel = Channel.query.get(message.channel_id)
            if channel:
                user = User.query.get(user_id)
                return user and user in channel.participants
        return False

    @staticmethod
    def get_recent_contacts(user_id, limit=30):
        try:
            uid = str(user_id)
            limit = int(limit or 30)
            if limit < 1:
                limit = 1
            if limit > 100:
                limit = 100

            other_id_expr = case(
                (Message.sender_id == uid, Message.target_id),
                else_=Message.sender_id,
            )

            base = (
                db.session.query(
                    other_id_expr.label("other_id"),
                    func.max(Message.created_at).label("last_at"),
                )
                .filter(
                    Message.group_id.is_(None),
                    Message.channel_id.is_(None),
                    Message.target_id.isnot(None),
                    or_(Message.sender_id == uid, Message.target_id == uid),
                )
                .group_by(other_id_expr)
                .subquery()
            )

            latest_rows = (
                db.session.query(Message, base.c.other_id, base.c.last_at)
                .join(
                    base,
                    (base.c.last_at == Message.created_at)
                    & (base.c.other_id == other_id_expr),
                )
                .order_by(base.c.last_at.desc())
                .limit(limit)
                .all()
            )

            ordered_ids: list[str] = []
            last_meta: dict[str, dict] = {}
            for msg, other_id, last_at in latest_rows:
                if not other_id:
                    continue
                other_id = str(other_id)
                if other_id == uid:
                    continue
                if other_id in last_meta:
                    continue
                content = MessageService._decrypt_content(msg.content) or ""
                content = content.strip()
                if msg.type == "voice":
                    preview = "🎤 Голосовое сообщение"
                elif msg.type == "image":
                    preview = "🖼️ Фото"
                elif msg.type == "file":
                    preview = "📎 Файл"
                else:
                    preview = content
                last_meta[other_id] = {
                    "last_message_at": last_at.isoformat() if last_at else None,
                    "last_message_text": preview,
                    "last_message_type": msg.type or "text",
                }
                ordered_ids.append(other_id)

            if not ordered_ids:
                return []

            users = User.query.filter(User.id.in_(ordered_ids)).all()
            users_map = {str(u.id): u for u in users}

            result = []
            for oid in ordered_ids:
                u = users_map.get(oid)
                if not u:
                    continue
                data = u.to_dict()
                meta = last_meta.get(oid) or {}
                for k, v in meta.items():
                    if v is not None:
                        data[k] = v
                result.append(data)
            return result
        except Exception as e:
            print(f"Error in get_recent_contacts: {e}")
            import traceback
            traceback.print_exc()
            return []
