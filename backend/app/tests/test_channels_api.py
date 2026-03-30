"""
Integration tests for Channels API endpoints.
Tests the /api/v1/channels endpoint for channel creation and related operations.
"""
import json
import pytest
from unittest.mock import patch, MagicMock

from app import create_app
from app.core.extensions import db
from app.models.user import User
from app.models.channel import Channel


@pytest.fixture
def app():
    """Create application for testing."""
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
    """Create test client."""
    return app.test_client()


@pytest.fixture
def test_user(app):
    """Create a test user."""
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
    """Create authentication headers for requests."""
    return {
        'Content-Type': 'application/json',
        'Authorization': f'Bearer {test_user.access_token}'
    }


class TestChannelCreationEndpoint:
    """Integration tests for POST /api/v1/channels endpoint."""

    def test_create_channel_success(self, client, auth_headers):
        """Test successful channel creation."""
        # Arrange
        payload = {
            "name": "Test Channel",
            "description": "Test Description"
        }
        
        # Act
        response = client.post(
            '/api/v1/channels/',
            headers=auth_headers,
            data=json.dumps(payload)
        )
        
        # Assert
        assert response.status_code == 201
        data = json.loads(response.data)
        assert data['name'] == "Test Channel"
        assert data['description'] == "Test Description"
        assert 'id' in data

    def test_create_channel_without_trailing_slash(self, client, auth_headers):
        """Test channel creation without trailing slash (405 fix verification)."""
        # Arrange
        payload = {
            "name": "Test Channel No Slash",
            "description": "Testing 405 fix"
        }
        
        # Act - POST to URL without trailing slash
        response = client.post(
            '/api/v1/channels',  # No trailing slash
            headers=auth_headers,
            data=json.dumps(payload)
        )
        
        # Assert - Should NOT return 405
        assert response.status_code == 201, "405 Method Not Allowed - trailing slash fix not working"
        data = json.loads(response.data)
        assert data['name'] == "Test Channel No Slash"

    def test_create_channel_missing_name(self, client, auth_headers):
        """Test channel creation with missing name returns 400."""
        # Arrange
        payload = {
            "description": "No name provided"
        }
        
        # Act
        response = client.post(
            '/api/v1/channels/',
            headers=auth_headers,
            data=json.dumps(payload)
        )
        
        # Assert
        assert response.status_code == 400
        data = json.loads(response.data)
        assert 'error' in data
        assert 'name' in data['error'].lower()

    def test_create_channel_empty_name(self, client, auth_headers):
        """Test channel creation with empty name returns 400."""
        # Arrange
        payload = {
            "name": "   ",
            "description": "Empty name"
        }
        
        # Act
        response = client.post(
            '/api/v1/channels/',
            headers=auth_headers,
            data=json.dumps(payload)
        )
        
        # Assert
        assert response.status_code == 400
        data = json.loads(response.data)
        assert 'error' in data

    def test_create_channel_name_too_long(self, client, auth_headers):
        """Test channel creation with name > 100 chars returns 400."""
        # Arrange
        payload = {
            "name": "A" * 101,
            "description": "Name too long"
        }
        
        # Act
        response = client.post(
            '/api/v1/channels/',
            headers=auth_headers,
            data=json.dumps(payload)
        )
        
        # Assert
        assert response.status_code == 400
        data = json.loads(response.data)
        assert 'error' in data
        assert '100' in data['error']

    def test_create_channel_description_too_long(self, client, auth_headers):
        """Test channel creation with description > 500 chars returns 400."""
        # Arrange
        payload = {
            "name": "Valid Name",
            "description": "B" * 501
        }
        
        # Act
        response = client.post(
            '/api/v1/channels/',
            headers=auth_headers,
            data=json.dumps(payload)
        )
        
        # Assert
        assert response.status_code == 400
        data = json.loads(response.data)
        assert 'error' in data
        assert '500' in data['error']

    def test_create_channel_without_description(self, client, auth_headers):
        """Test channel creation without description (optional field)."""
        # Arrange
        payload = {
            "name": "Channel Without Description"
        }
        
        # Act
        response = client.post(
            '/api/v1/channels/',
            headers=auth_headers,
            data=json.dumps(payload)
        )
        
        # Assert
        assert response.status_code == 201
        data = json.loads(response.data)
        assert data['name'] == "Channel Without Description"

    def test_create_channel_unauthorized(self, client):
        """Test channel creation without authentication returns 401."""
        # Arrange
        payload = {
            "name": "Unauthorized Channel"
        }
        
        # Act
        response = client.post(
            '/api/v1/channels/',
            headers={'Content-Type': 'application/json'},
            data=json.dumps(payload)
        )
        
        # Assert
        assert response.status_code == 401

    def test_create_channel_invalid_token(self, client):
        """Test channel creation with invalid token returns 401."""
        # Arrange
        payload = {
            "name": "Invalid Token Channel"
        }
        
        # Act
        response = client.post(
            '/api/v1/channels/',
            headers={
                'Content-Type': 'application/json',
                'Authorization': 'Bearer invalid-token'
            },
            data=json.dumps(payload)
        )
        
        # Assert
        assert response.status_code == 401

    def test_create_channel_empty_body(self, client, auth_headers):
        """Test channel creation with empty body returns 400."""
        # Act
        response = client.post(
            '/api/v1/channels/',
            headers=auth_headers,
            data=json.dumps({})
        )
        
        # Assert
        assert response.status_code == 400
        data = json.loads(response.data)
        assert 'error' in data

    def test_create_channel_null_body(self, client, auth_headers):
        """Test channel creation with null body returns 400."""
        # Act
        response = client.post(
            '/api/v1/channels/',
            headers=auth_headers,
            data='null'
        )
        
        # Assert
        assert response.status_code == 400
        data = json.loads(response.data)
        assert 'error' in data


class TestChannelJoinEndpoint:
    """Integration tests for POST /api/v1/channels/join endpoint."""

    def test_join_channel_success(self, client, auth_headers, test_user):
        """Test successful channel join."""
        # Arrange
        channel = Channel(
            id="test-channel-123",
            name="Test Channel",
            invite_code="INVITE123",
            owner_id="other-user"
        )
        db.session.add(channel)
        db.session.commit()
        
        payload = {"invite_code": "INVITE123"}
        
        # Act
        response = client.post(
            '/api/v1/channels/join',
            headers=auth_headers,
            data=json.dumps(payload)
        )
        
        # Assert
        assert response.status_code == 200
        data = json.loads(response.data)
        assert data['id'] == "test-channel-123"

    def test_join_channel_missing_invite_code(self, client, auth_headers):
        """Test join with missing invite code returns 400."""
        # Act
        response = client.post(
            '/api/v1/channels/join',
            headers=auth_headers,
            data=json.dumps({})
        )
        
        # Assert
        assert response.status_code == 400
        data = json.loads(response.data)
        assert 'error' in data

    def test_join_channel_invalid_invite_code(self, client, auth_headers):
        """Test join with invalid invite code returns 400."""
        # Arrange
        payload = {"invite_code": "INVALID"}
        
        # Act
        response = client.post(
            '/api/v1/channels/join',
            headers=auth_headers,
            data=json.dumps(payload)
        )
        
        # Assert
        assert response.status_code == 400
        data = json.loads(response.data)
        assert 'error' in data


class TestChannelMyEndpoint:
    """Integration tests for POST /api/v1/channels/my endpoint."""

    def test_get_my_channels_success(self, client, auth_headers, test_user):
        """Test getting user's channels."""
        # Arrange
        channel = Channel(
            id="my-channel-123",
            name="My Channel",
            owner_id=test_user.id
        )
        channel.participants.append(test_user)
        db.session.add(channel)
        db.session.commit()
        
        # Act
        response = client.post(
            '/api/v1/channels/my',
            headers=auth_headers
        )
        
        # Assert
        assert response.status_code == 200
        data = json.loads(response.data)
        assert isinstance(data, list)
        assert len(data) >= 1


class TestChannelDetailsEndpoint:
    """Integration tests for GET/POST /api/v1/channels/<id> endpoint."""

    def test_get_channel_details_success(self, client, auth_headers, test_user):
        """Test getting channel details."""
        # Arrange
        channel = Channel(
            id="channel-details-123",
            name="Details Channel",
            owner_id=test_user.id
        )
        channel.participants.append(test_user)
        db.session.add(channel)
        db.session.commit()
        
        # Act - Test GET method
        response = client.get(
            '/api/v1/channels/channel-details-123',
            headers=auth_headers
        )
        
        # Assert
        assert response.status_code == 200
        data = json.loads(response.data)
        assert data['id'] == "channel-details-123"

    def test_get_channel_details_not_found(self, client, auth_headers):
        """Test getting non-existent channel returns 404."""
        # Act
        response = client.get(
            '/api/v1/channels/nonexistent',
            headers=auth_headers
        )
        
        # Assert
        assert response.status_code == 404

    def test_get_channel_details_not_member(self, client, auth_headers, test_user):
        """Test getting channel details when not a member returns 403."""
        # Arrange
        channel = Channel(
            id="other-channel-123",
            name="Other Channel",
            owner_id="other-user"
        )
        db.session.add(channel)
        db.session.commit()
        
        # Act
        response = client.get(
            '/api/v1/channels/other-channel-123',
            headers=auth_headers
        )
        
        # Assert
        assert response.status_code == 403


class TestHTTP405Fix:
    """Tests specifically for the HTTP 405 fix."""

    def test_post_with_trailing_slash(self, client, auth_headers):
        """Verify POST works with trailing slash."""
        payload = {"name": "Trailing Slash Test"}
        
        response = client.post(
            '/api/v1/channels/',
            headers=auth_headers,
            data=json.dumps(payload)
        )
        
        assert response.status_code == 201, "POST with trailing slash should work"

    def test_post_without_trailing_slash(self, client, auth_headers):
        """Verify POST works without trailing slash (main 405 fix)."""
        payload = {"name": "No Trailing Slash Test"}
        
        response = client.post(
            '/api/v1/channels',
            headers=auth_headers,
            data=json.dumps(payload)
        )
        
        assert response.status_code == 201, "POST without trailing slash should work (405 fix)"

    def test_get_method_not_allowed_for_creation(self, client, auth_headers):
        """Verify GET method is not allowed on base channel endpoint."""
        response = client.get(
            '/api/v1/channels/',
            headers=auth_headers
        )
        
        # GET on base endpoint should return 405
        assert response.status_code == 405
