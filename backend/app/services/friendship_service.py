from datetime import datetime

from app.core.extensions import db
from app.models.friendship import Friendship
from app.models.user import User
from sqlalchemy import or_


class FriendshipService:
    @staticmethod
    def send_request(requester_id, addressee_id):
        requester_id = str(requester_id)
        addressee_id = str(addressee_id)

        if requester_id == addressee_id:
            return None, "Cannot add yourself"

        addressee = User.query.get(addressee_id)
        if not addressee:
            return None, "User not found"

        existing = Friendship.query.filter(
            or_(
                (Friendship.requester_id == requester_id)
                & (Friendship.addressee_id == addressee_id),
                (Friendship.requester_id == addressee_id)
                & (Friendship.addressee_id == requester_id),
            )
        ).first()

        if existing:
            if existing.status == "accepted":
                return None, "Already friends"
            if existing.status == "pending":
                return None, "Friend request already pending"

            if existing.status == "rejected":
                existing.status = "pending"
                existing.requester_id = requester_id
                existing.addressee_id = addressee_id
                existing.created_at = datetime.utcnow()
                try:
                    db.session.commit()
                    return existing, None
                except Exception as e:
                    db.session.rollback()
                    return None, str(e)

            return None, f"Request status: {existing.status}"

        new_request = Friendship(requester_id=requester_id, addressee_id=addressee_id)
        try:
            db.session.add(new_request)
            db.session.commit()
            return new_request, None
        except Exception as e:
            db.session.rollback()
            return None, str(e)

    @staticmethod
    def accept_request(user_id, requester_id):
        request = Friendship.query.filter_by(
            requester_id=requester_id, addressee_id=user_id, status="pending"
        ).first()

        if not request:
            return None, "Friend request not found"

        request.status = "accepted"
        try:
            db.session.commit()
            return request, None
        except Exception as e:
            db.session.rollback()
            return None, str(e)

    @staticmethod
    def reject_request(user_id, requester_id):
        request = Friendship.query.filter_by(
            requester_id=requester_id, addressee_id=user_id, status="pending"
        ).first()

        if not request:
            return None, "Friend request not found"

        try:
            db.session.delete(request)
            db.session.commit()
            return True, None
        except Exception as e:
            db.session.rollback()
            return None, str(e)

    @staticmethod
    def remove_friend(user_id, friend_id):
        friendship = Friendship.query.filter(
            or_(
                (Friendship.requester_id == user_id)
                & (Friendship.addressee_id == friend_id),
                (Friendship.requester_id == friend_id)
                & (Friendship.addressee_id == user_id),
            ),
            Friendship.status == "accepted",
        ).first()

        if not friendship:
            return None, "Friendship not found"

        try:
            db.session.delete(friendship)
            db.session.commit()
            return True, None
        except Exception as e:
            db.session.rollback()
            return None, str(e)

    @staticmethod
    def get_friends(user_id):
        friendships = Friendship.query.filter(
            or_(Friendship.requester_id == user_id, Friendship.addressee_id == user_id),
            Friendship.status == "accepted",
        ).all()

        friends = []
        for f in friendships:
            friend_id = f.addressee_id if f.requester_id == user_id else f.requester_id
            friend = User.query.get(friend_id)
            if friend:
                friends.append(friend.to_dict())
        return friends

    @staticmethod
    def get_pending_requests(user_id):
        user = User.query.get(user_id)
        if not user:
            return []

        requests = [f for f in user.friendships if f.status == "pending"]

        result = []
        for r in requests:
            requester = User.query.get(r.requester_id)
            if requester:
                data = requester.to_dict()
                data["request_created_at"] = r.created_at.isoformat()
                data["friendship_id"] = r.id
                result.append(data)
        return result
