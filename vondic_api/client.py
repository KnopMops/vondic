"""
Vondic API Client

Main client class for interacting with the Vondic Social Network Public API.
"""
from typing import Any, Dict, List, Optional
from urllib.parse import urljoin

import requests

from .exceptions import AuthenticationError, VondicAPIException
from .models import Comment, Message, Post, User


class VondicClient:
    """
    Main client class for interacting with the Vondic Social Network Public API.
    """

    def __init__(
            self,
            api_key: str,
            base_url: str = "https://api.vondic.knopusmedia.ru/api/public/v1"):
        """
        Initialize the Vondic API client.

        Args:
            api_key: Your API key for authentication
            base_url: Base URL for the API (defaults to production)
        """
        self.api_key = api_key
        self.base_url = base_url
        self.session = requests.Session()
        self.session.headers.update({
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        })

        # Rate limiting info
        self.rate_limit_remaining = None
        self.rate_limit_reset = None

    def _make_request(self, method: str, endpoint: str,
                      **kwargs) -> Dict[str, Any]:
        """
        Make an HTTP request to the API.

        Args:
            method: HTTP method (GET, POST, PUT, DELETE)
            endpoint: API endpoint (without base URL)
            **kwargs: Additional arguments for requests

        Returns:
            JSON response from the API

        Raises:
            VondicAPIException: For API errors
            AuthenticationError: For authentication errors
        """
        url = urljoin(self.base_url, endpoint)

        response = self.session.request(method, url, **kwargs)

        # Update rate limiting info
        self.rate_limit_remaining = response.headers.get(
            'X-RateLimit-Remaining')
        self.rate_limit_reset = response.headers.get('X-RateLimit-Reset')

        if response.status_code == 401:
            raise AuthenticationError("Invalid or expired API key")
        elif response.status_code >= 400:
            error_msg = response.text
            try:
                json_response = response.json()
                error_msg = json_response.get('message', error_msg)
            except BaseException:
                pass
            raise VondicAPIException(
                f"API Error: {response.status_code} - {error_msg}")

        try:
            return response.json()
        except ValueError:
            # If response is not JSON, return text
            return {"result": response.text}

    def get_user(self, user_id: str) -> User:
        """
        Get a specific user by ID.

        Args:
            user_id: The ID of the user to retrieve

        Returns:
            User object
        """
        response = self._make_request("GET", f"/users/{user_id}")
        return User.from_dict(response['data'])

    def get_current_user(self) -> User:
        """
        Get the current authenticated user.

        Returns:
            User object
        """
        response = self._make_request("GET", "/users/me")
        return User.from_dict(response['data'])

    def get_users(self, page: int = 1, limit: int = 20) -> List[User]:
        """
        Get a list of public users.

        Args:
            page: Page number (default: 1)
            limit: Number of results per page (default: 20, max: 100)

        Returns:
            List of User objects
        """
        params = {"page": page, "limit": limit}
        response = self._make_request("GET", "/users", params=params)
        return [User.from_dict(user_data) for user_data in response['data']]

    def update_user(self, **kwargs) -> User:
        """
        Update the current user's profile.

        Args:
            **kwargs: Fields to update (username, first_name, last_name, bio, avatar_url, website, location)

        Returns:
            Updated User object
        """
        response = self._make_request("PUT", "/users/me", json=kwargs)
        return User.from_dict(response['data'])

    def follow_user(self, user_id: str) -> bool:
        """
        Follow a user.

        Args:
            user_id: ID of the user to follow

        Returns:
            True if successful
        """
        self._make_request("POST", f"/users/{user_id}/follow")
        return True

    def unfollow_user(self, user_id: str) -> bool:
        """
        Unfollow a user.

        Args:
            user_id: ID of the user to unfollow

        Returns:
            True if successful
        """
        self._make_request("POST", f"/users/{user_id}/unfollow")
        return True

    def get_post(self, post_id: str) -> Post:
        """
        Get a specific post by ID.

        Args:
            post_id: The ID of the post to retrieve

        Returns:
            Post object
        """
        response = self._make_request("GET", f"/posts/{post_id}")
        return Post.from_dict(response['data'])

    def get_posts(self, page: int = 1, limit: int = 20) -> List[Post]:
        """
        Get a list of public posts.

        Args:
            page: Page number (default: 1)
            limit: Number of results per page (default: 20, max: 100)

        Returns:
            List of Post objects
        """
        params = {"page": page, "limit": limit}
        response = self._make_request("GET", "/posts", params=params)
        return [Post.from_dict(post_data) for post_data in response['data']]

    def create_post(self, content: str, privacy: str = "public",
                    media_urls: Optional[List[str]] = None,
                    location: Optional[str] = None,
                    tags: Optional[List[str]] = None) -> Post:
        """
        Create a new post.

        Args:
            content: Content of the post
            privacy: Privacy level ("public", "friends", "private") - default: "public"
            media_urls: List of media URLs to attach
            location: Location information
            tags: List of tags

        Returns:
            Created Post object
        """
        payload = {
            "content": content,
            "privacy": privacy
        }
        if media_urls:
            payload["media_urls"] = media_urls
        if location:
            payload["location"] = location
        if tags:
            payload["tags"] = tags

        response = self._make_request("POST", "/posts", json=payload)
        return Post.from_dict(response['data'])

    def update_post(self, post_id: str, **kwargs) -> Post:
        """
        Update an existing post.

        Args:
            post_id: ID of the post to update
            **kwargs: Fields to update (content, privacy, media_urls, location, tags)

        Returns:
            Updated Post object
        """
        response = self._make_request("PUT", f"/posts/{post_id}", json=kwargs)
        return Post.from_dict(response['data'])

    def delete_post(self, post_id: str) -> bool:
        """
        Delete a post.

        Args:
            post_id: ID of the post to delete

        Returns:
            True if successful
        """
        self._make_request("DELETE", f"/posts/{post_id}")
        return True

    def like_post(self, post_id: str) -> bool:
        """
        Like a post.

        Args:
            post_id: ID of the post to like

        Returns:
            True if successful
        """
        self._make_request("POST", f"/posts/{post_id}/like")
        return True

    def unlike_post(self, post_id: str) -> bool:
        """
        Unlike a post.

        Args:
            post_id: ID of the post to unlike

        Returns:
            True if successful
        """
        self._make_request("POST", f"/posts/{post_id}/unlike")
        return True

    def get_messages(self, thread_with: Optional[str] = None,
                     page: int = 1, limit: int = 20) -> List[Message]:
        """
        Get messages from the user's inbox.

        Args:
            thread_with: Filter by specific user ID
            page: Page number (default: 1)
            limit: Number of results per page (default: 20, max: 100)

        Returns:
            List of Message objects
        """
        params = {"page": page, "limit": limit}
        if thread_with:
            params["thread_with"] = thread_with

        response = self._make_request("GET", "/messages", params=params)
        return [Message.from_dict(msg_data) for msg_data in response['data']]

    def send_message(self, recipient_id: str, content: str,
                     media_urls: Optional[List[str]] = None) -> Message:
        """
        Send a new message to another user.

        Args:
            recipient_id: ID of the recipient
            content: Message content
            media_urls: List of media URLs to attach

        Returns:
            Sent Message object
        """
        payload = {
            "recipient_id": recipient_id,
            "content": content
        }
        if media_urls:
            payload["media_urls"] = media_urls

        response = self._make_request("POST", "/messages", json=payload)
        return Message.from_dict(response['data'])

    def get_message_threads(self, page: int = 1,
                            limit: int = 20) -> List[Dict[str, Any]]:
        """
        Get message threads (conversations) for the authenticated user.

        Args:
            page: Page number (default: 1)
            limit: Number of results per page (default: 20, max: 100)

        Returns:
            List of thread objects
        """
        params = {"page": page, "limit": limit}
        response = self._make_request(
            "GET", "/messages/threads", params=params)
        return response['data']

    def get_comments_for_post(
            self,
            post_id: str,
            page: int = 1,
            limit: int = 20) -> List[Comment]:
        """
        Get all comments for a specific post.

        Args:
            post_id: ID of the post
            page: Page number (default: 1)
            limit: Number of results per page (default: 20, max: 100)

        Returns:
            List of Comment objects
        """
        params = {"page": page, "limit": limit}
        response = self._make_request(
            "GET", f"/comments/post/{post_id}", params=params)
        return [Comment.from_dict(comment_data)
                for comment_data in response['data']]

    def create_comment(self, post_id: str, content: str) -> Comment:
        """
        Create a new comment on a post.

        Args:
            post_id: ID of the post to comment on
            content: Comment content

        Returns:
            Created Comment object
        """
        payload = {
            "post_id": post_id,
            "content": content
        }
        response = self._make_request("POST", "/comments", json=payload)
        return Comment.from_dict(response['data'])

    def update_comment(self, comment_id: str, content: str) -> Comment:
        """
        Update an existing comment.

        Args:
            comment_id: ID of the comment to update
            content: New comment content

        Returns:
            Updated Comment object
        """
        payload = {"content": content}
        response = self._make_request(
            "PUT", f"/comments/{comment_id}", json=payload)
        return Comment.from_dict(response['data'])

    def delete_comment(self, comment_id: str) -> bool:
        """
        Delete a comment.

        Args:
            comment_id: ID of the comment to delete

        Returns:
            True if successful
        """
        self._make_request("DELETE", f"/comments/{comment_id}")
        return True

    def like_comment(self, comment_id: str) -> bool:
        """
        Like a comment.

        Args:
            comment_id: ID of the comment to like

        Returns:
            True if successful
        """
        self._make_request("POST", f"/comments/{comment_id}/like")
        return True

    def unlike_comment(self, comment_id: str) -> bool:
        """
        Unlike a comment.

        Args:
            comment_id: ID of the comment to unlike

        Returns:
            True if successful
        """
        self._make_request("POST", f"/comments/{comment_id}/unlike")
        return True
