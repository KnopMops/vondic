import json
import os
import secrets
from datetime import datetime

from sqlalchemy import text
from app.core.config import Config
from app.core.extensions import db
from app.models.channel import Channel, channel_participants
from app.models.comment import Comment
from app.models.community import Community, community_members
from app.models.community_channel import CommunityChannel
from app.models.friendship import Friendship
from app.models.group import Group, group_participants
from app.models.like import Like
from app.models.message import Message
from app.models.post import Post
from app.models.subscription import Subscription
from app.models.user import User
from flask import current_app
from sqlalchemy import or_
from sqlalchemy.exc import IntegrityError
from werkzeug.security import check_password_hash, generate_password_hash

class UserService:
    @staticmethod
    def get_all_users():
        return User.query.all()

    @staticmethod
    def get_user_by_id(user_id):
        return User.query.get(user_id)

    @staticmethod
    def get_user_by_email(email):
        return User.query.filter_by(email=email).first()

    @staticmethod
    def get_user_by_telegram_id(telegram_id):
        return User.query.filter_by(telegram_id=telegram_id).first()

    @staticmethod
    def search_users(query_str):
        if not query_str or "@telegram.bot" in query_str:
            return []

        search = f"%{query_str}%"
        return (
            User.query.filter(
                or_(User.username.ilike(search), User.email.ilike(search))
            )
            .filter(~User.email.like("%@telegram.bot"))
            .all()
        )

    @staticmethod
    def create_user(data):
        try:
            new_user = User(
                username=data.get("username"),
                email=data.get("email"),
                password_hash=data.get("password_hash"),
                role=data.get("role", "User"),
            )
            db.session.add(new_user)
            db.session.commit()
            return new_user
        except IntegrityError:
            db.session.rollback()
            return None

    @staticmethod
    def update_user(user_id, data, current_user):
        user = User.query.get(user_id)
        if not user:
            return None, "Пользователь не найден"

        if user.id != current_user.id and current_user.role != "Admin":
            return None, "Неавторизовано"

        if "username" in data:
            user.username = data["username"]
        if "avatar_url" in data:
            user.avatar_url = data["avatar_url"]
        if "profile_bg_theme" in data:
            user.profile_bg_theme = data.get("profile_bg_theme")
            if user.profile_bg_theme:
                user.profile_bg_gradient = None
                user.profile_bg_image = None
        if "profile_bg_gradient" in data and current_user.premium:
            user.profile_bg_gradient = data.get("profile_bg_gradient")
            if user.profile_bg_gradient:
                user.profile_bg_theme = None
                user.profile_bg_image = None
        if "profile_bg_image" in data and current_user.premium:
            user.profile_bg_image = data.get("profile_bg_image")
            if user.profile_bg_image:
                user.profile_bg_theme = None
                user.profile_bg_gradient = None

        if "status" in data:
            raw_status = str(data.get("status") or "").strip().lower()
            status_map = {
                "online": "Online",
                "offline": "Offline",
                "в сети": "Online",
                "не в сети": "Offline",
            }
            if raw_status in status_map:
                user.status = status_map[raw_status]
            else:
                return None, "Неверный статус"

        if current_user.role == "Admin":
            if "role" in data:
                user.role = data["role"]
            if "premium" in data:
                user.premium = int(data["premium"])

        try:
            db.session.commit()
            return user, None
        except IntegrityError:
            db.session.rollback()
            return None, "Username already taken"
        except Exception as e:
            db.session.rollback()
            return None, str(e)

    @staticmethod
    def generate_link_key(user_id):
        user = User.query.get(user_id)
        if not user:
            return None, "User not found"

        try:
            key = "".join(secrets.choice("0123456789") for _ in range(6))
            user.link_key = key
            db.session.commit()
            return key, None
        except Exception as e:
            db.session.rollback()
            return None, str(e)

    @staticmethod
    def set_developer(user_id, enabled: bool):
        user = User.query.get(user_id)
        if not user:
            return None, "User not found"
        user.is_developer = 1 if enabled else 0
        if not enabled:
            user.api_key_hash = None
            user.api_key = None
        try:
            db.session.commit()
            return user, None
        except Exception as e:
            db.session.rollback()
            return None, str(e)

    @staticmethod
    def generate_api_key(user_id, rotate: bool = False):
        user = User.query.get(user_id)
        if not user:
            return None, "User not found"
        if user.api_key and not rotate:
            return user.api_key, None
        token = secrets.token_urlsafe(32)
        user.api_key_hash = generate_password_hash(token)
        user.api_key = token
        user.is_developer = 1
        try:
            db.session.commit()
            return token, None
        except Exception as e:
            db.session.rollback()
            return None, str(e)

    @staticmethod
    def get_api_key(user_id):
        user = User.query.get(user_id)
        if not user:
            return None, "User not found"
        return user.api_key, None

    @staticmethod
    def get_user_by_api_key(api_key):
        if not api_key:
            return None
        users = User.query.filter(User.api_key_hash.isnot(None)).all()
        for user in users:
            if user.api_key_hash and check_password_hash(
                    user.api_key_hash, api_key):
                return user
        return None

    @staticmethod
    def set_or_reset_cloud_password(user, new_password):
        if not user or not new_password:
            return "Invalid arguments"
        now = datetime.utcnow()
        month_key = now.year * 100 + now.month
        if not user.cloud_password_hash:
            user.cloud_password_hash = generate_password_hash(new_password)
            if user.cloud_password_reset_month is None:
                user.cloud_password_reset_month = month_key
                user.cloud_password_reset_count = 0
            return None
        if user.cloud_password_reset_month != month_key:
            user.cloud_password_reset_month = month_key
            user.cloud_password_reset_count = 0
        if user.cloud_password_reset_count is None:
            user.cloud_password_reset_count = 0
        if user.cloud_password_reset_count >= 3:
            return "Cloud password reset limit reached"
        user.cloud_password_hash = generate_password_hash(new_password)
        user.cloud_password_reset_count += 1
        return None

    @staticmethod
    def block_user(user_id, admin_user):
        if not admin_user or admin_user.role != "Admin":
            return None, "Неавторизовано"

        user = User.query.get(user_id)
        if not user:
            return None, "Пользователь не найден"

        user.is_blocked = 1
        user.is_blocked_at = datetime.utcnow()
        user.blocked_by_admin = admin_user.username
        try:
            db.session.commit()
            return user, None
        except Exception as e:
            db.session.rollback()
            return None, str(e)

    @staticmethod
    def unblock_user(user_id, admin_user):
        if not admin_user or admin_user.role != "Admin":
            return None, "Неавторизовано"

        user = User.query.get(user_id)
        if not user:
            return None, "Пользователь не найден"

        user.is_blocked = 0
        user.is_blocked_at = None
        user.blocked_by_admin = None
        try:
            db.session.commit()
            return user, None
        except Exception as e:
            db.session.rollback()
            return None, str(e)

    @staticmethod
    def delete_user_account(user_id: str):
        user = User.query.get(user_id)
        if not user:
            return None, "User not found"

        try:

            def delete_local_file(url: str | None):
                if not url or not isinstance(url, str):
                    return
                if url.startswith("http://") or url.startswith("https://"):
                    return
                abs_path = os.path.join(current_app.root_path, url.lstrip("/"))
                if os.path.exists(abs_path):
                    try:
                        os.remove(abs_path)
                    except Exception:
                        pass

            if user.avatar_url:
                delete_local_file(user.avatar_url)
            if user.profile_bg_image:
                delete_local_file(user.profile_bg_image)

            storis = user.storis or []
            if isinstance(storis, list):
                for item in storis:
                    if isinstance(item, dict):
                        delete_local_file(item.get("url"))

            messages_for_cleanup = Message.query.filter(
                or_(Message.sender_id == user_id, Message.target_id == user_id)
            ).all()
            for msg in messages_for_cleanup:
                attachments = msg.attachments or []
                if isinstance(attachments, list):
                    for a in attachments:
                        if isinstance(a, dict):
                            delete_local_file(a.get("url"))

            shared_db_path = os.path.join(Config.BASE_DIR, "database.db")
            result = db.session.execute(text("""
                SELECT attachments FROM post_reports WHERE reporter_id = :user_id
            """), {"user_id": user_id})
            report_rows = result.fetchall()
            for row in report_rows:
                try:
                    payload = row[0] if row else None
                    attachments = json.loads(payload) if payload else []
                    if isinstance(attachments, list):
                        for a in attachments:
                            if isinstance(a, dict):
                                delete_local_file(a.get("url"))
                except Exception:
                    continue

            result = db.session.execute(text("SELECT id FROM escalations WHERE user_id = :user_id"), {"user_id": user_id})
            esc_rows = result.fetchall()
            esc_ids = [r[0] for r in esc_rows if r and r[0] is not None]
            if esc_ids:
                placeholders = ",".join(f":id{i}" for i in range(len(esc_ids)))
                params = {f"id{i}": esc_id for i, esc_id in enumerate(esc_ids)}
                db.session.execute(text(f"""
                    DELETE FROM escalation_messages WHERE escalation_id IN ({placeholders})
                """), params)

            db.session.execute(text("DELETE FROM escalations WHERE user_id = :user_id"), {"user_id": user_id})
            db.session.execute(text("DELETE FROM notifications WHERE user_id = :user_id"), {"user_id": user_id})
            db.session.execute(text("DELETE FROM post_reports WHERE reporter_id = :user_id"), {"user_id": user_id})
            db.session.commit()
            webrtc_result = db.session.execute(text("""
                SELECT attachments FROM messages WHERE sender_id = :user_id OR target_id = :user_id
            """), {"user_id": user_id})
            webrtc_rows = webrtc_result.fetchall()
            for row in webrtc_rows:
                try:
                    payload = row[0] if row else None
                    attachments = json.loads(payload) if payload else []
                    if isinstance(attachments, list):
                        for a in attachments:
                            if isinstance(a, dict):
                                delete_local_file(a.get("url"))
                except Exception:
                    continue
            webrtc_cur.execute(
                "DELETE FROM messages WHERE sender_id = ? OR target_id = ?",
                (user_id, user_id),
            )
            webrtc_conn.commit()
            webrtc_conn.close()

            db.session.execute(
                group_participants.delete().where(
                    group_participants.c.user_id == user_id
                )
            )
            db.session.execute(
                community_members.delete().where(
                    community_members.c.user_id == user_id))
            db.session.execute(
                channel_participants.delete().where(
                    channel_participants.c.user_id == user_id
                )
            )

            Friendship.query.filter(
                or_(
                    Friendship.requester_id == user_id,
                    Friendship.addressee_id == user_id,
                )
            ).delete(synchronize_session=False)

            Subscription.query.filter(
                or_(
                    Subscription.subscriber_id == user_id,
                    Subscription.target_id == user_id,
                )
            ).delete(synchronize_session=False)

            Like.query.filter(Like.user_id == user_id).delete(
                synchronize_session=False)

            Comment.query.filter(Comment.posted_by == user_id).delete(
                synchronize_session=False
            )

            Message.query.filter(
                or_(Message.sender_id == user_id, Message.target_id == user_id)
            ).delete(synchronize_session=False)

            posts = Post.query.filter(Post.posted_by == user_id).all()
            for post in posts:
                Comment.query.filter(Comment.post_id == post.id).delete(
                    synchronize_session=False
                )
                Like.query.filter(Like.post_id == post.id).delete(
                    synchronize_session=False
                )
                attachments = post.attachments or []
                for a in attachments:
                    try:
                        url = a.get("url")
                        if url and isinstance(url, str):
                            abs_path = os.path.join(
                                current_app.root_path, url.lstrip("/")
                            )
                            if os.path.exists(abs_path):
                                try:
                                    os.remove(abs_path)
                                except Exception:
                                    pass
                    except Exception:
                        continue
                db.session.delete(post)

            groups = Group.query.filter(Group.owner_id == user_id).all()
            for group in groups:
                group_messages = Message.query.filter(
                    Message.group_id == group.id
                ).all()
                for msg in group_messages:
                    attachments = msg.attachments or []
                    if isinstance(attachments, list):
                        for a in attachments:
                            if isinstance(a, dict):
                                delete_local_file(a.get("url"))
                Message.query.filter(Message.group_id == group.id).delete(
                    synchronize_session=False
                )
                db.session.execute(
                    group_participants.delete().where(
                        group_participants.c.group_id == group.id
                    )
                )
                db.session.delete(group)

            communities = Community.query.filter(
                Community.owner_id == user_id).all()
            for community in communities:
                CommunityChannel.query.filter(
                    CommunityChannel.community_id == community.id
                ).delete(synchronize_session=False)
                db.session.execute(
                    community_members.delete().where(
                        community_members.c.community_id == community.id
                    )
                )
                db.session.delete(community)

            channels = Channel.query.filter(Channel.owner_id == user_id).all()
            for channel in channels:
                db.session.execute(
                    channel_participants.delete().where(
                        channel_participants.c.channel_id == channel.id
                    )
                )
                db.session.delete(channel)

            if channels:
                channel_ids = [c.id for c in channels]
                placeholders = ",".join(f":id{i}" for i in range(len(channel_ids)))
                params = {f"id{i}": channel_id for i, channel_id in enumerate(channel_ids)}
                channel_result = db.session.execute(text(f"""
                    SELECT attachments FROM messages WHERE channel_id IN ({placeholders})
                """), params)
                channel_rows = channel_result.fetchall()
                for row in channel_rows:
                    try:
                        payload = row[0] if row else None
                        attachments = json.loads(payload) if payload else []
                        if isinstance(attachments, list):
                            for a in attachments:
                                if isinstance(a, dict):
                                    delete_local_file(a.get("url"))
                    except Exception:
                        continue
                webrtc_cur.execute(
                    f"DELETE FROM messages WHERE channel_id IN ({placeholders})", channel_ids, )
                webrtc_conn.commit()
                webrtc_conn.close()

            db.session.delete(user)
            db.session.commit()
            return True, None
        except Exception as e:
            db.session.rollback()
            return None, str(e)
