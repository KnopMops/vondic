import html
from datetime import datetime, timedelta

from app.core.extensions import cache, db
from app.models.group import Group
from app.models.message import Message
from app.models.user import User
from app.models.user_conversation import UserConversation
from app.services.user_service import UserService
from app.utils.mtproto_crypto import mtproto_decrypt
from sqlalchemy import case, func, or_


class MessageService:
    @staticmethod
    def ensure_dm_conversation(user_id, partner_id, is_secret=None):
        """Keep DM chat in sidebar after history is cleared."""
        uid = str(user_id)
        pid = str(partner_id)
        if not uid or not pid or uid == pid:
            return
        try:
            for a, b in ((uid, pid), (pid, uid)):
                row = UserConversation.query.filter_by(
                    user_id=a, partner_id=b
                ).first()
                if row:
                    if is_secret is not None and a == uid:
                        row.is_secret = bool(is_secret)
                else:
                    db.session.add(UserConversation(user_id=a, partner_id=b, is_secret=bool(
                        is_secret) if a == uid and is_secret is not None else False, ))
            db.session.commit()
        except Exception:
            db.session.rollback()

    @staticmethod
    def get_dm_settings(user_id, partner_id):
        uid = str(user_id)
        pid = str(partner_id)
        row = UserConversation.query.filter_by(
            user_id=uid, partner_id=pid).first()
        if not row:
            MessageService.ensure_dm_conversation(uid, pid)
            row = UserConversation.query.filter_by(
                user_id=uid, partner_id=pid).first()
        return {
            "partner_id": pid,
            "is_secret": bool(row.is_secret) if row else False,
        }

    @staticmethod
    def set_dm_secret(user_id, partner_id, is_secret: bool):
        uid = str(user_id)
        pid = str(partner_id)
        MessageService.ensure_dm_conversation(uid, pid, is_secret=is_secret)
        row = UserConversation.query.filter_by(
            user_id=uid, partner_id=pid).first()
        if row:
            row.is_secret = bool(is_secret)
            db.session.commit()
        return MessageService.get_dm_settings(uid, pid)

    @staticmethod
    def _sanitize_text(value):
        if value is None:
            return None
        if not isinstance(value, str):
            value = str(value)
        val = value.strip()
        if val.startswith("encproxy:") or val.startswith("e2e:"):
            return val
        return html.escape(val, quote=False)


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

        reply_to_id = data.get("reply_to_id")
        disappear_after = data.get("disappear_after")
        disappear_at = None
        if disappear_after and isinstance(disappear_after, (int, float)) and disappear_after > 0:
            disappear_at = datetime.utcnow() + timedelta(seconds=int(disappear_after))

        if data.get("is_silent"):
            if attachments is None:
                attachments = []
            attachments.append({"type": "flag", "is_silent": True})

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
                reply_to_id=reply_to_id,
                disappear_after=disappear_after,
                disappear_at=disappear_at,
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
                reply_to_id=reply_to_id,
                disappear_after=disappear_after,
                disappear_at=disappear_at,
            )
        else:
            return None, "Either group_id or target_id is required"

        try:
            db.session.add(new_message)
            db.session.commit()

            try:
                cache.delete_memoized(MessageService.get_recent_contacts, user_id)
                if target_id:
                    cache.delete_memoized(MessageService.get_recent_contacts, target_id)
            except Exception:
                pass
            if target_id:
                try:
                    target_user = User.query.get(target_id)
                    if target_user and (getattr(target_user, "is_bot", False) or str(target_id) == "7e140ffc-5549-418a-8bad-525c02193812"):
                        import time
                        from app.api.public.v1.bots import _q_push, _pub_notify
                        sender = User.query.get(user_id)
                        sender_name = getattr(sender, "username", None) or getattr(sender, "name", "User")
                        bot_update = {
                            "update_id": int(time.time() * 1000),
                            "message": {
                                "message_id": new_message.id,
                                "from": {
                                    "id": str(user_id),
                                    "username": sender_name,
                                    "first_name": sender_name,
                                },
                                "chat": {
                                    "id": str(user_id),
                                    "type": "private",
                                },
                                "text": new_message.content or "",
                                "date": int(time.time()),
                            }
                        }
                        _q_push(f"bot:updates:{target_id}", bot_update)
                        _pub_notify(f"bot:updates:{target_id}")
                except Exception as e:
                    print(f"Error pushing update to bot: {e}")

                for a, b in ((user_id, target_id), (target_id, user_id)):
                    exists = UserConversation.query.filter_by(
                        user_id=str(a), partner_id=str(b)
                    ).first()
                    if not exists:
                        db.session.add(UserConversation(
                            user_id=str(a), partner_id=str(b)))
                db.session.commit()

            return new_message, None
        except Exception as e:
            db.session.rollback()
            return None, str(e)

    @staticmethod
    def send_message(
        sender_id,
        content,
        target_user_id=None,
        channel_id=None,
        group_id=None,
        msg_type="text",
        attachments=None,
        reply_to_id=None,
        is_silent=False,
        disappear_after=None
    ):
        data = {
            "content": content,
            "type": msg_type,
            "attachments": attachments or [],
            "reply_to_id": reply_to_id,
            "is_silent": is_silent,
            "disappear_after": disappear_after,
        }
        if channel_id:
            return MessageService.create_channel_message(data, sender_id, channel_id)
        return MessageService.create_message(data, sender_id, group_id=group_id, target_id=target_user_id)

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

        is_community_channel = channel.community_channel is not None
        if (
            not is_community_channel
            and channel.type == "broadcast"
            and str(channel.owner_id) != str(user_id)
        ):
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
    @cache.memoize(timeout=15)
    def get_recent_contacts(user_id, limit=30):
        try:
            uid = str(user_id)
            limit = int(limit or 30)
            if limit < 1:
                limit = 1
            if limit > 100:
                limit = 100

            conv_partners = (
                db.session.query(UserConversation.partner_id)
                .filter(UserConversation.user_id == uid)
                .all()
            )
            conv_partner_ids = {str(p[0]) for p in conv_partners}
            conv_rows = UserConversation.query.filter_by(user_id=uid).all()
            conv_secret = {
                str(c.partner_id): bool(getattr(c, "is_secret", False))
                for c in conv_rows
            }

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
                raw_content = (msg.content or "").strip()
                if msg.type == "voice":
                    preview = "🎤 Голосовое сообщение"
                elif msg.type == "image":
                    preview = "🖼️ Фото"
                elif msg.type == "file":
                    preview = "📎 Файл"
                elif raw_content.startswith("e2e:"):
                    preview = "🔐 Зашифрованное сообщение"
                elif raw_content.startswith("encproxy:"):
                    preview = "🛡️ Зашифровано EncProxy"

                else:
                    decrypted = MessageService._decrypt_content(
                        raw_content) or ""
                    preview = (decrypted or raw_content).strip()
                last_meta[other_id] = {
                    "last_message_at": last_at.isoformat() if last_at else None,
                    "last_message_text": preview,
                    "last_message_type": msg.type or "text",
                    "last_message_raw": raw_content,
                    "last_message_sender_id": str(
                        msg.sender_id) if msg.sender_id else None,
                    "last_message_target_id": str(
                        msg.target_id) if msg.target_id else None,
                }
                ordered_ids.append(other_id)

            for pid in conv_partner_ids:
                if pid not in last_meta and pid != uid:
                    ordered_ids.append(pid)

            from app.services.friendship_service import FriendshipService

            seen_ids = set(ordered_ids)
            for friend in FriendshipService.get_friends(uid) or []:
                fid = str(friend.get("id") or "")
                if fid and fid != uid and fid not in seen_ids:
                    ordered_ids.append(fid)
                    seen_ids.add(fid)

            if not ordered_ids:
                return []

            users = User.query.filter(User.id.in_(ordered_ids)).all()
            users_map = {str(u.id): u for u in users}

            result = []
            for oid in ordered_ids:
                u = users_map.get(oid)
                if not u:
                    continue
                data = u.to_dict(viewer_id=uid)
                meta = last_meta.get(oid)
                if meta:
                    for k, v in meta.items():
                        if v is not None:
                            data[k] = v
                else:
                    data["last_message_at"] = None
                    data["last_message_text"] = ""
                    data["last_message_type"] = "text"
                    data["last_message_raw"] = ""
                    data["last_message_sender_id"] = None
                    data["last_message_target_id"] = None
                data["is_secret"] = conv_secret.get(oid, False)
                result.append(data)
            return result
        except Exception as e:
            print(f"Error in get_recent_contacts: {e}")
            import traceback
            traceback.print_exc()
            return []
