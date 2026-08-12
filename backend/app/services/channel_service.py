from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from app.core.extensions import db
from app.models.channel import Channel
from app.models.user import User


class ChannelService:
    @staticmethod
    def create_channel(data, user_id):
        name = data.get("name")
        description = data.get("description")

        if not name:
            return None, "Channel name is required"

        if len(name) > 100:
            return None, "Channel name must not exceed 100 characters"

        if description and len(description) > 500:
            return None, "Description must not exceed 500 characters"

        owner = User.query.get(user_id)
        if not owner:
            return None, "User not found"

        new_channel = Channel(
            name=name, description=description, owner_id=user_id)
        new_channel.participants.append(owner)

        try:
            db.session.add(new_channel)
            db.session.commit()
            return new_channel, None
        except IntegrityError as e:
            db.session.rollback()
            error_msg = str(e.orig) if hasattr(e, 'orig') else str(e)
            if 'unique' in error_msg.lower() or 'duplicate' in error_msg.lower():
                return None, "Channel with this name already exists"
            return None, f"Database integrity error: {error_msg}"
        except SQLAlchemyError as e:
            db.session.rollback()
            return None, f"Database error: {str(e)}"
        except Exception as e:
            db.session.rollback()
            return None, f"Unexpected error: {str(e)}"

    @staticmethod
    def resolve_channel(code_or_id):
        if not code_or_id:
            return None
        key = str(code_or_id).strip()
        channel = Channel.query.filter_by(invite_code=key).first()
        if not channel:
            channel = Channel.query.get(key)
        return channel

    @staticmethod
    def get_invite_code(channel_id):
        channel = Channel.query.get(channel_id)
        if not channel:
            return None, "Channel not found"
        if not channel.invite_code:
            import uuid
            channel.invite_code = str(uuid.uuid4())[:8]
            try:
                db.session.commit()
            except Exception:
                db.session.rollback()
        return channel.invite_code, None

    @staticmethod
    def join_channel(invite_code, user_id):
        channel = ChannelService.resolve_channel(invite_code)
        if not channel:
            return None, "Invalid invite code"

        user = User.query.get(user_id)
        if not user:
            return None, "User not found"

        if bool(getattr(channel, "require_approval", False)) and str(channel.owner_id) != str(user_id):
            from app.models.join_request import JoinRequest
            existing = JoinRequest.query.filter_by(
                target_type="channel", target_id=channel.id, user_id=user_id, status="pending"
            ).first()
            if not existing:
                req = JoinRequest(
                    target_type="channel", target_id=channel.id, user_id=user_id, status="pending"
                )
                db.session.add(req)
                db.session.commit()
                try:
                    from app.api.v1.join_requests import push_join_request_bot_message
                    push_join_request_bot_message(req.id, channel.owner_id, channel.name, "channel", user)
                except Exception:
                    pass
            return channel, "pending_approval"

        if user in channel.participants:
            return channel, None

        try:
            channel.participants.append(user)
            db.session.commit()
            return channel, None
        except Exception as e:
            db.session.rollback()
            return None, str(e)

    @staticmethod
    def get_channel_by_id(channel_id):
        return Channel.query.get(channel_id)

    @staticmethod
    def get_user_channels(user_id):
        user = User.query.get(user_id)
        if not user:
            return []

        channels_list = []
        joined_ids = set()
        for ch in user.channels:
            d = ch.to_dict() if hasattr(ch, "to_dict") else ch
            d["is_pending_approval"] = False
            channels_list.append(d)
            joined_ids.add(str(ch.id))

        try:
            from app.models.join_request import JoinRequest
            pending_reqs = JoinRequest.query.filter_by(user_id=user_id, target_type="channel", status="pending").all()
            for req in pending_reqs:
                if str(req.target_id) not in joined_ids:
                    ch = Channel.query.get(req.target_id)
                    if ch:
                        d = ch.to_dict() if hasattr(ch, "to_dict") else ch
                        d["is_pending_approval"] = True
                        d["join_request_id"] = req.id
                        channels_list.append(d)
                        joined_ids.add(str(ch.id))
        except Exception:
            pass

        return channels_list

    @staticmethod
    def is_owner(channel_id, user_id):
        channel = Channel.query.get(channel_id)
        if not channel:
            return False
        return str(channel.owner_id) == str(user_id)

    @staticmethod
    def update_channel(channel_id, data):
        channel = Channel.query.get(channel_id)
        if not channel:
            return None, "Channel not found"
        if data.get("name") is not None:
            channel.name = data["name"]
        if data.get("description") is not None:
            channel.description = data["description"]
        if data.get("avatar_url") is not None:
            channel.avatar_url = data["avatar_url"]
        if data.get("type") is not None:
            channel.type = data["type"]
        if data.get("require_approval") is not None:
            channel.require_approval = bool(data["require_approval"])
        try:
            db.session.commit()
            return channel, None
        except Exception as e:
            db.session.rollback()
            return None, str(e)

    @staticmethod
    def leave_channel(channel_id, user_id):
        channel = Channel.query.get(channel_id)
        if not channel:
            return None, "Channel not found"
        user = User.query.get(user_id)
        if not user:
            return None, "User not found"

        # Remove any pending join requests for this channel
        try:
            from app.models.join_request import JoinRequest
            reqs = JoinRequest.query.filter_by(user_id=user_id, target_id=channel_id, target_type="channel").all()
            for r in reqs:
                db.session.delete(r)
        except Exception:
            pass

        if user in channel.participants:
            try:
                channel.participants.remove(user)
                db.session.commit()
                return channel, None
            except Exception as e:
                db.session.rollback()
                return None, str(e)

        try:
            db.session.commit()
            return channel, None
        except Exception as e:
            db.session.rollback()
            return channel, None

    @staticmethod
    def delete_channel(channel_id, user_id):
        channel = Channel.query.get(channel_id)
        if not channel:
            return None, "Channel not found"
        user = User.query.get(user_id)
        if not user:
            return None, "User not found"
        if str(channel.owner_id) != str(user_id):
            return None, "Unauthorized"
        try:
            db.session.delete(channel)
            db.session.commit()
            return True, None
        except Exception as e:
            db.session.rollback()
            return None, str(e)

    @staticmethod
    def add_subscriber(channel_id_or_code, user_id):
        return ChannelService.join_channel(channel_id_or_code, user_id)

    @staticmethod
    def remove_subscriber(channel_id, user_id):
        return ChannelService.leave_channel(channel_id, user_id)

    @staticmethod
    def search_channels(query, user_id):
        user = User.query.get(user_id)
        if not user:
            return []

        results = Channel.query.filter(
            (Channel.name.ilike(
                f"%{query}%")) | (
                Channel.description.ilike(
                    f"%{query}%"))).all()
        return [ch for ch in results if user not in ch.participants]
