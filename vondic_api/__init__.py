"""
Vondic API Client Library

A Python library for interacting with the Vondic Social Network Public API.
"""

from .client import VondicClient
from .exceptions import AuthenticationError, VondicAPIException
from .models import Comment, Message, Post, User

__version__ = "0.1.0"
__author__ = "Vondic Team"
__all__ = ["VondicClient", "User", "Post", "Message",
           "Comment", "VondicAPIException", "AuthenticationError"]
