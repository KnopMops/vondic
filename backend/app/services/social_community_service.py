from sqlalchemy import insert

from app.core.extensions import db
from app.models.social_community import SocialCommunity, social_community_members
from app.models.user import User


class SocialCommunityService:
    @staticmethod
    def create(data, user_id):
        name = (data.get("name") or "").strip()
        if not name:
            return None, "Community name is required"
        community = SocialCommunity(
            name=name,
            description=data.get("description"),
            avatar_url=data.get("avatar_url"),
            is_public=bool(data.get("is_public", True)),
            owner_id=user_id,
        )
        try:
            db.session.add(community)
            db.session.flush()
            db.session.execute(
                insert(social_community_members).values(
                    user_id=user_id,
                    social_community_id=community.id,
                    role="owner",
                )
            )
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
        return user.social_communities

    @staticmethod
    def get_by_id(community_id):
        return SocialCommunity.query.get(community_id)

    @staticmethod
    def user_is_member(community, user) -> bool:
        if not community or not user:
            return False
        if str(community.owner_id) == str(user.id):
            return True
        return user in community.members

    @staticmethod
    def resolve(code_or_id):
        if not code_or_id:
            return None
        key = str(code_or_id).strip()
        community = SocialCommunity.query.filter_by(invite_code=key).first()
        if not community:
            community = SocialCommunity.query.get(key)
        return community

    @staticmethod
    def join(invite_code, user_id):
        community = SocialCommunityService.resolve(invite_code)
        if not community:
            return None, "Invalid invite code"
        user = User.query.get(user_id)
        if not user:
            return None, "User not found"
        if user in community.members:
            return community, None
        try:
            community.members.append(user)
            db.session.commit()
            return community, None
        except Exception as e:
            db.session.rollback()
            return None, str(e)

    @staticmethod
    def leave(community_id, user_id):
        community = SocialCommunity.query.get(community_id)
        if not community:
            return None, "Community not found"
        if str(community.owner_id) == str(user_id):
            return None, "Owner cannot leave; transfer ownership first"
        user = User.query.get(user_id)
        if not user or user not in community.members:
            return None, "Not a member"
        try:
            community.members.remove(user)
            db.session.commit()
            return community, None
        except Exception as e:
            db.session.rollback()
            return None, str(e)

    @staticmethod
    def update(community_id, data, user_id):
        community = SocialCommunity.query.get(community_id)
        if not community:
            return None, "Community not found"
        if str(community.owner_id) != str(user_id):
            return None, "Only owner can update"
        if data.get("name") is not None:
            name = str(data["name"]).strip()
            if name:
                community.name = name
        if data.get("description") is not None:
            community.description = data["description"]
        if data.get("avatar_url") is not None:
            community.avatar_url = data["avatar_url"] or None
        if data.get("cover_url") is not None:
            community.cover_url = data["cover_url"] or None
        if data.get("is_public") is not None:
            community.is_public = bool(data["is_public"])
        try:
            db.session.commit()
            return community, None
        except Exception as e:
            db.session.rollback()
            return None, str(e)

    @staticmethod
    def search(query, user_id):
        user = User.query.get(user_id)
        if not user:
            return []
        q = f"%{query}%"
        results = SocialCommunity.query.filter(
            SocialCommunity.is_public.is_(True),
            (SocialCommunity.name.ilike(q))
            | (SocialCommunity.description.ilike(q)),
        ).all()
        return [c for c in results if user not in c.members]
