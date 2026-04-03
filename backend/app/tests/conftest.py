
import pytest
from unittest.mock import patch, MagicMock


@pytest.fixture
def mock_token_required():

    def decorator(f):
        def wrapper(*args, **kwargs):
            return f(*args, **kwargs)
        return wrapper
    return decorator


@pytest.fixture
def sample_channel_data():

    return {
        "name": "Test Channel",
        "description": "Test Description"
    }


@pytest.fixture
def sample_user_data():

    return {
        "id": "test-user-123",
        "username": "testuser",
        "email": "test@example.com"
    }
