
import pytest
from unittest.mock import MagicMock, patch
from sqlalchemy.exc import IntegrityError

from app.services.channel_service import ChannelService
from app.models.channel import Channel
from app.models.user import User


class TestChannelServiceCreateChannel:


    def test_create_channel_success(self):


        data = {"name": "Test Channel", "description": "Test Description"}
        user_id = "user-123"

        mock_user = MagicMock(spec=User)
        mock_user.id = user_id

        mock_channel = MagicMock(spec=Channel)
        mock_channel.id = "channel-456"
        mock_channel.name = "Test Channel"
        mock_channel.description = "Test Description"
        mock_channel.participants = []

        with patch('app.services.channel_service.User.query') as mock_user_query, \
             patch('app.services.channel_service.Channel') as mock_channel_class, \
             patch('app.services.channel_service.db.session') as mock_session:

            mock_user_query.get.return_value = mock_user
            mock_channel_class.return_value = mock_channel


            channel, error = ChannelService.create_channel(data, user_id)


            assert error is None
            assert channel == mock_channel
            mock_session.add.assert_called_once()
            mock_session.commit.assert_called_once()

    def test_create_channel_missing_name(self):


        data = {"description": "Test Description"}
        user_id = "user-123"


        channel, error = ChannelService.create_channel(data, user_id)


        assert channel is None
        assert error == "Channel name is required"

    def test_create_channel_name_too_long(self):


        data = {"name": "A" * 101, "description": "Test"}
        user_id = "user-123"


        channel, error = ChannelService.create_channel(data, user_id)


        assert channel is None
        assert error == "Channel name must not exceed 100 characters"

    def test_create_channel_description_too_long(self):


        data = {"name": "Test Channel", "description": "B" * 501}
        user_id = "user-123"


        channel, error = ChannelService.create_channel(data, user_id)


        assert channel is None
        assert error == "Description must not exceed 500 characters"

    def test_create_channel_user_not_found(self):


        data = {"name": "Test Channel"}
        user_id = "nonexistent-user"

        with patch('app.services.channel_service.User.query') as mock_user_query:
            mock_user_query.get.return_value = None


            channel, error = ChannelService.create_channel(data, user_id)


            assert channel is None
            assert error == "User not found"

    def test_create_channel_integrity_error_duplicate(self):


        data = {"name": "Existing Channel"}
        user_id = "user-123"

        mock_user = MagicMock(spec=User)
        mock_user.id = user_id

        mock_integrity_error = IntegrityError(
            statement="INSERT INTO channels",
            params=None,
            orig=MagicMock(spec=Exception)
        )
        mock_integrity_error.orig.__str__ = lambda self: "duplicate key value violates unique constraint"

        with patch('app.services.channel_service.User.query') as mock_user_query, \
             patch('app.services.channel_service.Channel') as mock_channel_class, \
             patch('app.services.channel_service.db.session') as mock_session:

            mock_user_query.get.return_value = mock_user
            mock_session.add.side_effect = mock_integrity_error


            channel, error = ChannelService.create_channel(data, user_id)


            assert channel is None
            assert "already exists" in error
            mock_session.rollback.assert_called_once()

    def test_create_channel_database_error(self):


        data = {"name": "Test Channel"}
        user_id = "user-123"

        mock_user = MagicMock(spec=User)
        mock_user.id = user_id

        from sqlalchemy.exc import SQLAlchemyError
        mock_db_error = SQLAlchemyError("Connection failed")

        with patch('app.services.channel_service.User.query') as mock_user_query, \
             patch('app.services.channel_service.Channel') as mock_channel_class, \
             patch('app.services.channel_service.db.session') as mock_session:

            mock_user_query.get.return_value = mock_user
            mock_session.add.side_effect = mock_db_error


            channel, error = ChannelService.create_channel(data, user_id)


            assert channel is None
            assert "Database error" in error
            mock_session.rollback.assert_called_once()

    def test_create_channel_without_description(self):


        data = {"name": "Test Channel"}
        user_id = "user-123"

        mock_user = MagicMock(spec=User)
        mock_user.id = user_id

        mock_channel = MagicMock(spec=Channel)
        mock_channel.id = "channel-456"
        mock_channel.name = "Test Channel"
        mock_channel.description = None
        mock_channel.participants = []

        with patch('app.services.channel_service.User.query') as mock_user_query, \
             patch('app.services.channel_service.Channel') as mock_channel_class, \
             patch('app.services.channel_service.db.session') as mock_session:

            mock_user_query.get.return_value = mock_user
            mock_channel_class.return_value = mock_channel


            channel, error = ChannelService.create_channel(data, user_id)


            assert error is None
            assert channel == mock_channel


class TestChannelServiceJoinChannel:


    def test_join_channel_success(self):


        invite_code = "abc12345"
        user_id = "user-123"

        mock_channel = MagicMock(spec=Channel)
        mock_channel.id = "channel-456"
        mock_channel.participants = []

        mock_user = MagicMock(spec=User)
        mock_user.id = user_id

        with patch('app.services.channel_service.Channel.query') as mock_channel_query, \
             patch('app.services.channel_service.User.query') as mock_user_query, \
             patch('app.services.channel_service.db.session') as mock_session:

            mock_channel_query.filter_by.return_value.first.return_value = mock_channel
            mock_user_query.get.return_value = mock_user


            channel, error = ChannelService.join_channel(invite_code, user_id)


            assert error is None
            assert channel == mock_channel
            mock_session.commit.assert_called_once()

    def test_join_channel_invalid_invite_code(self):


        invite_code = "invalid"
        user_id = "user-123"

        with patch('app.services.channel_service.Channel.query') as mock_channel_query:
            mock_channel_query.filter_by.return_value.first.return_value = None


            channel, error = ChannelService.join_channel(invite_code, user_id)


            assert channel is None
            assert error == "Invalid invite code"

    def test_join_channel_user_not_found(self):


        invite_code = "abc12345"
        user_id = "nonexistent-user"

        mock_channel = MagicMock(spec=Channel)

        with patch('app.services.channel_service.Channel.query') as mock_channel_query, \
             patch('app.services.channel_service.User.query') as mock_user_query:

            mock_channel_query.filter_by.return_value.first.return_value = mock_channel
            mock_user_query.get.return_value = None


            channel, error = ChannelService.join_channel(invite_code, user_id)


            assert channel is None
            assert error == "User not found"

    def test_join_channel_already_member(self):


        invite_code = "abc12345"
        user_id = "user-123"

        mock_channel = MagicMock(spec=Channel)
        mock_channel.participants = [MagicMock(id=user_id)]

        mock_user = MagicMock(spec=User)
        mock_user.id = user_id

        with patch('app.services.channel_service.Channel.query') as mock_channel_query, \
             patch('app.services.channel_service.User.query') as mock_user_query:

            mock_channel_query.filter_by.return_value.first.return_value = mock_channel
            mock_user_query.get.return_value = mock_user


            channel, error = ChannelService.join_channel(invite_code, user_id)


            assert channel is None
            assert error == "Already a participant"


class TestChannelServiceGetChannelById:


    def test_get_channel_by_id_exists(self):


        channel_id = "channel-123"
        mock_channel = MagicMock(spec=Channel)

        with patch('app.services.channel_service.Channel.query') as mock_channel_query:
            mock_channel_query.get.return_value = mock_channel


            result = ChannelService.get_channel_by_id(channel_id)


            assert result == mock_channel

    def test_get_channel_by_id_not_found(self):


        channel_id = "nonexistent"

        with patch('app.services.channel_service.Channel.query') as mock_channel_query:
            mock_channel_query.get.return_value = None


            result = ChannelService.get_channel_by_id(channel_id)


            assert result is None


class TestChannelServiceGetUserChannels:


    def test_get_user_channels_success(self):


        user_id = "user-123"
        mock_user = MagicMock(spec=User)
        mock_user.channels = [MagicMock(spec=Channel), MagicMock(spec=Channel)]

        with patch('app.services.channel_service.User.query') as mock_user_query:
            mock_user_query.get.return_value = mock_user


            result = ChannelService.get_user_channels(user_id)


            assert result == mock_user.channels

    def test_get_user_channels_user_not_found(self):


        user_id = "nonexistent"

        with patch('app.services.channel_service.User.query') as mock_user_query:
            mock_user_query.get.return_value = None


            result = ChannelService.get_user_channels(user_id)


            assert result == []


class TestChannelServiceIsOwner:


    def test_is_owner_true(self):


        channel_id = "channel-123"
        user_id = "owner-456"

        mock_channel = MagicMock(spec=Channel)
        mock_channel.owner_id = user_id

        with patch('app.services.channel_service.Channel.query') as mock_channel_query:
            mock_channel_query.get.return_value = mock_channel


            result = ChannelService.is_owner(channel_id, user_id)


            assert result is True

    def test_is_owner_false(self):


        channel_id = "channel-123"
        user_id = "user-456"

        mock_channel = MagicMock(spec=Channel)
        mock_channel.owner_id = "other-owner"

        with patch('app.services.channel_service.Channel.query') as mock_channel_query:
            mock_channel_query.get.return_value = mock_channel


            result = ChannelService.is_owner(channel_id, user_id)


            assert result is False

    def test_is_owner_channel_not_found(self):


        channel_id = "nonexistent"
        user_id = "user-456"

        with patch('app.services.channel_service.Channel.query') as mock_channel_query:
            mock_channel_query.get.return_value = None


            result = ChannelService.is_owner(channel_id, user_id)


            assert result is False
