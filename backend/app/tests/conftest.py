"""
Pytest configuration and shared fixtures for Vondic backend tests.
"""
import pytest
from unittest.mock import patch, MagicMock


@pytest.fixture
def mock_token_required():
    """Mock the token_required decorator for testing."""
    def decorator(f):
        def wrapper(*args, **kwargs):
            return f(*args, **kwargs)
        return wrapper
    return decorator


@pytest.fixture
def sample_channel_data():
    """Sample valid channel data for testing."""
    return {
        "name": "Test Channel",
        "description": "Test Description"
    }


@pytest.fixture
def sample_user_data():
    """Sample valid user data for testing."""
    return {
        "id": "test-user-123",
        "username": "testuser",
        "email": "test@example.com"
    }
