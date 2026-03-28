from app.core.extensions import db
from app.models.subscription import Subscription
from app.models.user import User

class SubscriptionService:
    @staticmethod
    def subscribe(subscriber_id, target_id):
        subscriber_id = str(subscriber_id)
        target_id = str(target_id)

        if subscriber_id == target_id:
            return None, "Cannot subscribe to yourself"

        target = User.query.get(target_id)
        if not target:
            return None, "User not found"

        existing = Subscription.query.filter_by(
            subscriber_id=subscriber_id, target_id=target_id
        ).first()

        if existing:
            return None, "Already subscribed"

        sub = Subscription(subscriber_id=subscriber_id, target_id=target_id)
        try:
            db.session.add(sub)
            db.session.commit()
            return sub, None
        except Exception as e:
            db.session.rollback()
            return None, str(e)

    @staticmethod
    def unsubscribe(subscriber_id, target_id):
        subscriber_id = str(subscriber_id)
        target_id = str(target_id)

        sub = Subscription.query.filter_by(
            subscriber_id=subscriber_id, target_id=target_id
        ).first()

        if not sub:
            return None, "Subscription not found"

        try:
            db.session.delete(sub)
            db.session.commit()
            return True, None
        except Exception as e:
            db.session.rollback()
            return None, str(e)

    @staticmethod
    def get_followers(user_id):
        user_id = str(user_id)
        subs = Subscription.query.filter_by(target_id=user_id).all()
        result = []
        for s in subs:
            user = User.query.get(s.subscriber_id)
            if user:
                data = user.to_dict()
                data["subscription_created_at"] = s.created_at.isoformat()
                result.append(data)
        return result

    @staticmethod
    def get_following(user_id):
        user_id = str(user_id)
        subs = Subscription.query.filter_by(subscriber_id=user_id).all()
        result = []
        for s in subs:
            user = User.query.get(s.target_id)
            if user:
                data = user.to_dict()
                data["subscription_created_at"] = s.created_at.isoformat()
                result.append(data)
        return result
