from app.core.extensions import db
from app.models.community import Community
from app.models.user import User

class CommunityService:
    @staticmethod
    def create_community(data, user_id):
        name = data.get("name")
        description = data.get("description")
        if not name:
            return None, "Community name is required"
        community = Community(
            name=name, description=description, owner_id=user_id)
        owner = User.query.get(user_id)
        if owner:
            community.members.append(owner)
        try:
            db.session.add(community)
            db.session.commit()
            return community, None
        except Exception as e:
            db.session.rollback()
            return None, str(e)

    @staticmethod
    def get_user_communities(user_id):
        user = User.query.get(user_id)
        if not user:
            return []
        return user.communities

    @staticmethod
    def get_by_id(community_id):
        return Community.query.get(community_id)

    @staticmethod
    def join_community(invite_code, user_id):

        community = Community.query.filter_by(invite_code=invite_code).first()
        if not community:
            return None, "Invalid invite code"

        user = User.query.get(user_id)
        if not user:
            return None, "User not found"

        if user in community.members:
            return None, "User already a member"

        try:

            community.members.append(user)
            db.session.commit()
            return community, None
        except Exception as e:
            db.session.rollback()
            return None, str(e)
