from unittest.mock import Mock, patch

import pytest

from vondic_api import Post, User, VondicClient
from vondic_api.exceptions import AuthenticationError, VondicAPIException


def test_client_initialization():
    client = VondicClient(api_key="test_key")
    assert client.api_key == "test_key"
    assert client.base_url == "https://api.vondic.com/api/public/v1"
    assert client.session.headers["Authorization"] == "Bearer test_key"


@patch('requests.Session.request')
def test_get_current_user(mock_request):
    mock_response = Mock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        'data': {
            'id': '123',
            'username': 'testuser',
            'first_name': 'Test',
            'last_name': 'User',
            'created_at': '2023-01-01T00:00:00'
        }
    }
    mock_request.return_value = mock_response

    client = VondicClient(api_key="test_key")
    user = client.get_current_user()

    assert isinstance(user, User)
    assert user.id == '123'
    assert user.username == 'testuser'


@patch('requests.Session.request')
def test_create_post(mock_request):
    mock_response = Mock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        'data': {
            'id': '456',
            'content': 'Test post content',
            'user_id': '123',
            'privacy': 'public',
            'created_at': '2023-01-01T00:00:00'
        }
    }
    mock_request.return_value = mock_response

    client = VondicClient(api_key="test_key")
    post = client.create_post(content="Test post content")

    assert isinstance(post, Post)
    assert post.id == '456'
    assert post.content == 'Test post content'


@patch('requests.Session.request')
def test_authentication_error(mock_request):
    mock_response = Mock()
    mock_response.status_code = 401
    mock_request.return_value = mock_response

    client = VondicClient(api_key="invalid_key")

    with pytest.raises(AuthenticationError):
        client.get_current_user()


@patch('requests.Session.request')
def test_api_error(mock_request):
    mock_response = Mock()
    mock_response.status_code = 400
    mock_response.text = "Bad Request"
    mock_request.return_value = mock_response

    client = VondicClient(api_key="test_key")

    with pytest.raises(VondicAPIException):
        client.get_current_user()


if __name__ == "__main__":
    pytest.main([__file__])
