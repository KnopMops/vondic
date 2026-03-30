from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from app.core.extensions import db
from app.models.channel import Channel
from app.models.user import User

class ChannelService:
    @staticmethod
    def create_channel(data, user_id):
        """
        Create a new channel.
        
        Args:
            data: Dictionary with 'name' and optional 'description'
            user_id: ID of the user creating the channel
            
        Returns:
            Tuple of (channel, error_message)
        """
        name = data.get("name")
        description = data.get("description")

        if not name:
            return None, "Channel name is required"

        # Validate name length
        if len(name) > 100:
            return None, "Channel name must not exceed 100 characters"

        # Validate description length if provided
        if description and len(description) > 500:
            return None, "Description must not exceed 500 characters"

        # Check if user exists
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
