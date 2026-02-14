
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

        new_channel = Channel(
            name=name,
            description=description,
            owner_id=user_id
        )
        # Add owner to participants automatically
        owner = User.query.get(user_id)
        if owner:
            new_channel.participants.append(owner)

        try:
            db.session.add(new_channel)
            db.session.commit()
            return new_channel, None
        except Exception as e:
            db.session.rollback()
            return None, str(e)

    @staticmethod
    def join_channel(invite_code, user_id):
        channel = Channel.query.filter_by(invite_code=invite_code).first()
        if not channel:
            return None, "Invalid invite code"

        user = User.query.get(user_id)
        if not user:
            return None, "User not found"

        if user in channel.participants:
            return None, "Already a participant"

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
        return user.channels

    @staticmethod
    def is_owner(channel_id, user_id):
        channel = Channel.query.get(channel_id)
        if not channel:
            return False
        return str(channel.owner_id) == str(user_id)
