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

        communities_list = []
        joined_ids = set()
        for c in user.communities:
            d = c.to_dict() if hasattr(c, "to_dict") else c
            d["is_pending_approval"] = False
            communities_list.append(d)
            joined_ids.add(str(c.id))

        try:
            from app.models.join_request import JoinRequest
            pending_reqs = JoinRequest.query.filter_by(user_id=user_id, target_type="community", status="pending").all()
            for req in pending_reqs:
                if str(req.target_id) not in joined_ids:
                    c = Community.query.get(req.target_id)
                    if c:
                        d = c.to_dict() if hasattr(c, "to_dict") else c
                        d["is_pending_approval"] = True
                        d["join_request_id"] = req.id
                        communities_list.append(d)
                        joined_ids.add(str(c.id))
        except Exception:
            pass

        return communities_list

    @staticmethod
    def get_by_id(community_id):
        return Community.query.get(community_id)

    @staticmethod
    def resolve_community(code_or_id):
        if not code_or_id:
            return None
        key = str(code_or_id).strip()
        community = Community.query.filter_by(invite_code=key).first()
        if not community:
            community = Community.query.get(key)
        return community

    @staticmethod
    def get_invite_code(community_id):
        community = Community.query.get(community_id)
        if not community:
            return None, "Community not found"
        if not community.invite_code:
            import uuid
            community.invite_code = str(uuid.uuid4())[:8]
            try:
                db.session.commit()
            except Exception:
                db.session.rollback()
        return community.invite_code, None

    @staticmethod
    def join_community(invite_code, user_id):
        community = CommunityService.resolve_community(invite_code)
        if not community:
            return None, "Invalid invite code"

        user = User.query.get(user_id)
        if not user:
            return None, "User not found"

        if user in community.members:
            return community, None

        if getattr(community, "require_approval", False) and str(community.owner_id) != str(user_id):
            from app.models.join_request import JoinRequest
            existing = JoinRequest.query.filter_by(
                target_type="community", target_id=community.id, user_id=user_id, status="pending"
            ).first()
            if not existing:
                req = JoinRequest(
                    target_type="community", target_id=community.id, user_id=user_id, status="pending"
                )
                db.session.add(req)
                db.session.commit()
                try:
                    from app.api.v1.join_requests import push_join_request_bot_message
                    push_join_request_bot_message(req.id, community.owner_id, community.name, "community", user)
                except Exception:
                    pass
            return community, "pending_approval"

        try:
            community.members.append(user)
            db.session.flush()
            from app.services.community_channel_service import (
                CommunityChannelService,
            )

            CommunityChannelService.sync_channel_participants(community, user)
            return community, None
        except Exception as e:
            db.session.rollback()
            return None, str(e)

    @staticmethod
    def update_community(community_id, data):
        community = Community.query.get(community_id)
        if not community:
            return None, "Community not found"
        if data.get("name") is not None:
            community.name = data["name"]
        if data.get("description") is not None:
            community.description = data["description"]
        if data.get("avatar_url") is not None:
            community.avatar_url = data["avatar_url"]
        if data.get("require_approval") is not None:
            community.require_approval = bool(data["require_approval"])
        try:
            db.session.commit()
            return community, None
        except Exception as e:
            db.session.rollback()
            return None, str(e)

    @staticmethod
    def leave_community(community_id, user_id):
        community = Community.query.get(community_id)
        if not community:
            return None, "Community not found"
        user = User.query.get(user_id)
        if not user:
            return None, "User not found"
        if user not in community.members:
            return None, "Not a member"
        try:
            community.members.remove(user)
            db.session.commit()
            return community, None
        except Exception as e:
            db.session.rollback()
            return None, str(e)

    @staticmethod
    def search_communities(query, user_id):
        user = User.query.get(user_id)
        if not user:
            return []
        results = Community.query.filter(
            (Community.name.ilike(
                f"%{query}%")) | (
                Community.description.ilike(
                    f"%{query}%"))).all()
        return [c for c in results if user not in c.members]
