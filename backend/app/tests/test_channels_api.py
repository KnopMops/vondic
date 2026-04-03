
import json
import pytest
from unittest.mock import patch, MagicMock

from app import create_app
from app.core.extensions import db
from app.models.user import User
from app.models.channel import Channel


@pytest.fixture
def app():

    app = create_app()
    app.config['TESTING'] = True
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///:memory:'
    app.config['WTF_CSRF_ENABLED'] = False
    app.config['SECRET_KEY'] = 'test-secret-key'

    with app.app_context():
        db.create_all()
        yield app
        db.session.remove()
        db.drop_all()


@pytest.fixture
def client(app):

    return app.test_client()


@pytest.fixture
def test_user(app):

    with app.app_context():
        user = User(
            id="test-user-123",
            username="testuser",
            email="test@example.com",
            access_token="valid-token-123"
        )
        db.session.add(user)
        db.session.commit()
        return user


@pytest.fixture
def auth_headers(test_user):

    return {
        'Content-Type': 'application/json',
        'Authorization': f'Bearer {test_user.access_token}'
    }


class TestChannelCreationEndpoint:


    def test_create_channel_success(self, client, auth_headers):


        payload = {
            "name": "Test Channel",
            "description": "Test Description"
        }


        response = client.post(
            '/api/v1/channels/',
            headers=auth_headers,
            data=json.dumps(payload)
        )


        assert response.status_code == 201
        data = json.loads(response.data)
        assert data['name'] == "Test Channel"
        assert data['description'] == "Test Description"
        assert 'id' in data

    def test_create_channel_without_trailing_slash(self, client, auth_headers):


        payload = {
            "name": "Test Channel No Slash",
            "description": "Testing 405 fix"
        }


        response = client.post(
            '/api/v1/channels',
            headers=auth_headers,
            data=json.dumps(payload)
        )


        assert response.status_code == 201, "405 Method Not Allowed - trailing slash fix not working"
        data = json.loads(response.data)
        assert data['name'] == "Test Channel No Slash"

    def test_create_channel_missing_name(self, client, auth_headers):


        payload = {
            "description": "No name provided"
        }


        response = client.post(
            '/api/v1/channels/',
            headers=auth_headers,
            data=json.dumps(payload)
        )


        assert response.status_code == 400
        data = json.loads(response.data)
        assert 'error' in data
        assert 'name' in data['error'].lower()

    def test_create_channel_empty_name(self, client, auth_headers):


        payload = {
            "name": "   ",
            "description": "Empty name"
        }


        response = client.post(
            '/api/v1/channels/',
            headers=auth_headers,
            data=json.dumps(payload)
        )


        assert response.status_code == 400
        data = json.loads(response.data)
        assert 'error' in data

    def test_create_channel_name_too_long(self, client, auth_headers):


        payload = {
            "name": "A" * 101,
            "description": "Name too long"
        }


        response = client.post(
            '/api/v1/channels/',
            headers=auth_headers,
            data=json.dumps(payload)
        )


        assert response.status_code == 400
        data = json.loads(response.data)
        assert 'error' in data
        assert '100' in data['error']

    def test_create_channel_description_too_long(self, client, auth_headers):


        payload = {
            "name": "Valid Name",
            "description": "B" * 501
        }


        response = client.post(
            '/api/v1/channels/',
            headers=auth_headers,
            data=json.dumps(payload)
        )


        assert response.status_code == 400
        data = json.loads(response.data)
        assert 'error' in data
        assert '500' in data['error']

    def test_create_channel_without_description(self, client, auth_headers):


        payload = {
            "name": "Channel Without Description"
        }


        response = client.post(
            '/api/v1/channels/',
            headers=auth_headers,
            data=json.dumps(payload)
        )


        assert response.status_code == 201
        data = json.loads(response.data)
        assert data['name'] == "Channel Without Description"

    def test_create_channel_unauthorized(self, client):


        payload = {
            "name": "Unauthorized Channel"
        }


        response = client.post(
            '/api/v1/channels/',
            headers={'Content-Type': 'application/json'},
            data=json.dumps(payload)
        )


        assert response.status_code == 401

    def test_create_channel_invalid_token(self, client):


        payload = {
            "name": "Invalid Token Channel"
        }


        response = client.post(
            '/api/v1/channels/',
            headers={
                'Content-Type': 'application/json',
                'Authorization': 'Bearer invalid-token'
            },
            data=json.dumps(payload)
        )


        assert response.status_code == 401

    def test_create_channel_empty_body(self, client, auth_headers):


        response = client.post(
            '/api/v1/channels/',
            headers=auth_headers,
            data=json.dumps({})
        )


        assert response.status_code == 400
        data = json.loads(response.data)
        assert 'error' in data

    def test_create_channel_null_body(self, client, auth_headers):


        response = client.post(
            '/api/v1/channels/',
            headers=auth_headers,
            data='null'
        )


        assert response.status_code == 400
        data = json.loads(response.data)
        assert 'error' in data


class TestChannelJoinEndpoint:


    def test_join_channel_success(self, client, auth_headers, test_user):


        channel = Channel(
            id="test-channel-123",
            name="Test Channel",
            invite_code="INVITE123",
            owner_id="other-user"
        )
        db.session.add(channel)
        db.session.commit()

        payload = {"invite_code": "INVITE123"}


        response = client.post(
            '/api/v1/channels/join',
            headers=auth_headers,
            data=json.dumps(payload)
        )


        assert response.status_code == 200
        data = json.loads(response.data)
        assert data['id'] == "test-channel-123"

    def test_join_channel_missing_invite_code(self, client, auth_headers):


        response = client.post(
            '/api/v1/channels/join',
            headers=auth_headers,
            data=json.dumps({})
        )


        assert response.status_code == 400
        data = json.loads(response.data)
        assert 'error' in data

    def test_join_channel_invalid_invite_code(self, client, auth_headers):


        payload = {"invite_code": "INVALID"}


        response = client.post(
            '/api/v1/channels/join',
            headers=auth_headers,
            data=json.dumps(payload)
        )


        assert response.status_code == 400
        data = json.loads(response.data)
        assert 'error' in data


class TestChannelMyEndpoint:


    def test_get_my_channels_success(self, client, auth_headers, test_user):


        channel = Channel(
            id="my-channel-123",
            name="My Channel",
            owner_id=test_user.id
        )
        channel.participants.append(test_user)
        db.session.add(channel)
        db.session.commit()


        response = client.post(
            '/api/v1/channels/my',
            headers=auth_headers
        )


        assert response.status_code == 200
        data = json.loads(response.data)
        assert isinstance(data, list)
        assert len(data) >= 1


class TestChannelDetailsEndpoint:


    def test_get_channel_details_success(self, client, auth_headers, test_user):


        channel = Channel(
            id="channel-details-123",
            name="Details Channel",
            owner_id=test_user.id
        )
        channel.participants.append(test_user)
        db.session.add(channel)
        db.session.commit()


        response = client.get(
            '/api/v1/channels/channel-details-123',
            headers=auth_headers
        )


        assert response.status_code == 200
        data = json.loads(response.data)
        assert data['id'] == "channel-details-123"

    def test_get_channel_details_not_found(self, client, auth_headers):


        response = client.get(
            '/api/v1/channels/nonexistent',
            headers=auth_headers
        )


        assert response.status_code == 404

    def test_get_channel_details_not_member(self, client, auth_headers, test_user):


        channel = Channel(
            id="other-channel-123",
            name="Other Channel",
            owner_id="other-user"
        )
        db.session.add(channel)
        db.session.commit()


        response = client.get(
            '/api/v1/channels/other-channel-123',
            headers=auth_headers
        )


        assert response.status_code == 403


class TestHTTP405Fix:


    def test_post_with_trailing_slash(self, client, auth_headers):

        payload = {"name": "Trailing Slash Test"}

        response = client.post(
            '/api/v1/channels/',
            headers=auth_headers,
            data=json.dumps(payload)
        )

        assert response.status_code == 201, "POST with trailing slash should work"

    def test_post_without_trailing_slash(self, client, auth_headers):

        payload = {"name": "No Trailing Slash Test"}

        response = client.post(
            '/api/v1/channels',
            headers=auth_headers,
            data=json.dumps(payload)
        )

        assert response.status_code == 201, "POST without trailing slash should work (405 fix)"

    def test_get_method_not_allowed_for_creation(self, client, auth_headers):

        response = client.get(
            '/api/v1/channels/',
            headers=auth_headers
        )


        assert response.status_code == 405
