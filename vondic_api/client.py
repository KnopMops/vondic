from typing import Any, Dict, List, Optional
from urllib.parse import urljoin

import requests

from .exceptions import AuthenticationError, VondicAPIException
from .models import Comment, Message, Post, User

class VondicClient:

    def __init__(
            self,
            api_key: str,
            base_url: str = "https://api.vondic.knopusmedia.ru/api/public/v1"):
        self.api_key = api_key
        self.base_url = base_url
        self.session = requests.Session()
        self.session.headers.update({
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        })

        self.rate_limit_remaining = None
        self.rate_limit_reset = None

    def _make_request(self, method: str, endpoint: str,
                      **kwargs) -> Dict[str, Any]:
        url = urljoin(self.base_url, endpoint)

        response = self.session.request(method, url, **kwargs)

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

            return {"result": response.text}

    def get_user(self, user_id: str) -> User:
        response = self._make_request("GET", f"/users/{user_id}")
        return User.from_dict(response['data'])

    def get_current_user(self) -> User:
        response = self._make_request("GET", "/users/me")
        return User.from_dict(response['data'])

    def get_users(self, page: int = 1, limit: int = 20) -> List[User]:
        params = {"page": page, "limit": limit}
        response = self._make_request("GET", "/users", params=params)
        return [User.from_dict(user_data) for user_data in response['data']]

    def update_user(self, **kwargs) -> User:
        response = self._make_request("PUT", "/users/me", json=kwargs)
        return User.from_dict(response['data'])

    def follow_user(self, user_id: str) -> bool:
        self._make_request("POST", f"/users/{user_id}/follow")
        return True

    def unfollow_user(self, user_id: str) -> bool:
        self._make_request("POST", f"/users/{user_id}/unfollow")
        return True

    def get_post(self, post_id: str) -> Post:
        response = self._make_request("GET", f"/posts/{post_id}")
        return Post.from_dict(response['data'])

    def get_posts(self, page: int = 1, limit: int = 20) -> List[Post]:
        params = {"page": page, "limit": limit}
        response = self._make_request("GET", "/posts", params=params)
        return [Post.from_dict(post_data) for post_data in response['data']]

    def create_post(self, content: str, privacy: str = "public",
                    media_urls: Optional[List[str]] = None,
                    location: Optional[str] = None,
                    tags: Optional[List[str]] = None) -> Post:
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
        response = self._make_request("PUT", f"/posts/{post_id}", json=kwargs)
        return Post.from_dict(response['data'])

    def delete_post(self, post_id: str) -> bool:
        self._make_request("DELETE", f"/posts/{post_id}")
        return True

    def like_post(self, post_id: str) -> bool:
        self._make_request("POST", f"/posts/{post_id}/like")
        return True

    def unlike_post(self, post_id: str) -> bool:
        self._make_request("POST", f"/posts/{post_id}/unlike")
        return True

    def get_messages(self, thread_with: Optional[str] = None,
                     page: int = 1, limit: int = 20) -> List[Message]:
        params = {"page": page, "limit": limit}
        if thread_with:
            params["thread_with"] = thread_with

        response = self._make_request("GET", "/messages", params=params)
        return [Message.from_dict(msg_data) for msg_data in response['data']]

    def send_message(self, recipient_id: str, content: str,
                     media_urls: Optional[List[str]] = None) -> Message:
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
        params = {"page": page, "limit": limit}
        response = self._make_request(
            "GET", "/messages/threads", params=params)
        return response['data']

    def get_comments_for_post(
            self,
            post_id: str,
            page: int = 1,
            limit: int = 20) -> List[Comment]:
        params = {"page": page, "limit": limit}
        response = self._make_request(
            "GET", f"/comments/post/{post_id}", params=params)
        return [Comment.from_dict(comment_data)
                for comment_data in response['data']]

    def create_comment(self, post_id: str, content: str) -> Comment:
        payload = {
            "post_id": post_id,
            "content": content
        }
        response = self._make_request("POST", "/comments", json=payload)
        return Comment.from_dict(response['data'])

    def update_comment(self, comment_id: str, content: str) -> Comment:
        payload = {"content": content}
        response = self._make_request(
            "PUT", f"/comments/{comment_id}", json=payload)
        return Comment.from_dict(response['data'])

    def delete_comment(self, comment_id: str) -> bool:
        self._make_request("DELETE", f"/comments/{comment_id}")
        return True

    def like_comment(self, comment_id: str) -> bool:
        self._make_request("POST", f"/comments/{comment_id}/like")
        return True

    def unlike_comment(self, comment_id: str) -> bool:
        self._make_request("POST", f"/comments/{comment_id}/unlike")
        return True
