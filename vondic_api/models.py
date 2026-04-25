from dataclasses import dataclass
from datetime import datetime
from typing import Any, Dict, List, Optional


@dataclass
class User:
    id: str
    username: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    bio: Optional[str] = None
    avatar_url: Optional[str] = None
    website: Optional[str] = None
    location: Optional[str] = None
    followers_count: int = 0
    following_count: int = 0
    posts_count: int = 0
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'User':
        return cls(
            id=data.get('id'),
            username=data.get('username'),
            first_name=data.get('first_name'),
            last_name=data.get('last_name'),
            bio=data.get('bio'),
            avatar_url=data.get('avatar_url'),
            website=data.get('website'),
            location=data.get('location'),
            followers_count=data.get('followers_count', 0),
            following_count=data.get('following_count', 0),
            posts_count=data.get('posts_count', 0),
            created_at=datetime.fromisoformat(
                data['created_at']) if data.get('created_at') else None,
            updated_at=datetime.fromisoformat(
                data['updated_at']) if data.get('updated_at') else None
        )

    def to_dict(self) -> Dict[str, Any]:
        return {
            'id': self.id,
            'username': self.username,
            'first_name': self.first_name,
            'last_name': self.last_name,
            'bio': self.bio,
            'avatar_url': self.avatar_url,
            'website': self.website,
            'location': self.location,
            'followers_count': self.followers_count,
            'following_count': self.following_count,
            'posts_count': self.posts_count,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None}


@dataclass
class Post:
    id: str
    content: str
    user_id: str
    user: Optional[User] = None
    privacy: str = "public"
    media_urls: Optional[List[str]] = None
    location: Optional[str] = None
    tags: Optional[List[str]] = None
    likes_count: int = 0
    comments_count: int = 0
    shares_count: int = 0
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'Post':
        user_data = data.get('user')
        user = User.from_dict(user_data) if user_data else None

        return cls(
            id=data.get('id'),
            content=data.get('content'),
            user_id=data.get('user_id'),
            user=user,
            privacy=data.get('privacy', 'public'),
            media_urls=data.get('media_urls'),
            location=data.get('location'),
            tags=data.get('tags'),
            likes_count=data.get('likes_count', 0),
            comments_count=data.get('comments_count', 0),
            shares_count=data.get('shares_count', 0),
            created_at=datetime.fromisoformat(
                data['created_at']) if data.get('created_at') else None,
            updated_at=datetime.fromisoformat(
                data['updated_at']) if data.get('updated_at') else None
        )

    def to_dict(self) -> Dict[str, Any]:
        return {
            'id': self.id,
            'content': self.content,
            'user_id': self.user_id,
            'user': self.user.to_dict() if self.user else None,
            'privacy': self.privacy,
            'media_urls': self.media_urls,
            'location': self.location,
            'tags': self.tags,
            'likes_count': self.likes_count,
            'comments_count': self.comments_count,
            'shares_count': self.shares_count,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None}


@dataclass
class Message:
    id: str
    sender_id: str
    recipient_id: str
    content: str
    sender: Optional[User] = None
    recipient: Optional[User] = None
    media_urls: Optional[List[str]] = None
    read: bool = False
    delivered: bool = False
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'Message':
        sender_data = data.get('sender')
        recipient_data = data.get('recipient')

        sender = User.from_dict(sender_data) if sender_data else None
        recipient = User.from_dict(recipient_data) if recipient_data else None

        return cls(
            id=data.get('id'),
            sender_id=data.get('sender_id'),
            recipient_id=data.get('recipient_id'),
            content=data.get('content'),
            sender=sender,
            recipient=recipient,
            media_urls=data.get('media_urls'),
            read=data.get('read', False),
            delivered=data.get('delivered', False),
            created_at=datetime.fromisoformat(
                data['created_at']) if data.get('created_at') else None,
            updated_at=datetime.fromisoformat(
                data['updated_at']) if data.get('updated_at') else None
        )

    def to_dict(self) -> Dict[str, Any]:
        return {
            'id': self.id,
            'sender_id': self.sender_id,
            'recipient_id': self.recipient_id,
            'content': self.content,
            'sender': self.sender.to_dict() if self.sender else None,
            'recipient': self.recipient.to_dict() if self.recipient else None,
            'media_urls': self.media_urls,
            'read': self.read,
            'delivered': self.delivered,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None}


@dataclass
class Comment:
    id: str
    content: str
    post_id: str
    user_id: str
    user: Optional[User] = None
    post: Optional[Post] = None
    parent_id: Optional[str] = None
    likes_count: int = 0
    replies_count: int = 0
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'Comment':
        user_data = data.get('user')
        post_data = data.get('post')

        user = User.from_dict(user_data) if user_data else None
        post = Post.from_dict(post_data) if post_data else None

        return cls(
            id=data.get('id'),
            content=data.get('content'),
            post_id=data.get('post_id'),
            user_id=data.get('user_id'),
            user=user,
            post=post,
            parent_id=data.get('parent_id'),
            likes_count=data.get('likes_count', 0),
            replies_count=data.get('replies_count', 0),
            created_at=datetime.fromisoformat(
                data['created_at']) if data.get('created_at') else None,
            updated_at=datetime.fromisoformat(
                data['updated_at']) if data.get('updated_at') else None
        )

    def to_dict(self) -> Dict[str, Any]:
        return {
            'id': self.id,
            'content': self.content,
            'post_id': self.post_id,
            'user_id': self.user_id,
            'user': self.user.to_dict() if self.user else None,
            'post': self.post.to_dict() if self.post else None,
            'parent_id': self.parent_id,
            'likes_count': self.likes_count,
            'replies_count': self.replies_count,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None}
