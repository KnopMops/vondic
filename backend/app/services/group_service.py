from app.core.extensions import db
from app.models.group import Group
from app.models.user import User


class GroupService:
    @staticmethod
    def create_group(data, user_id):
        name = data.get("name")
        description = data.get("description")

        if not name:
            return None, "Group name is required"

        new_group = Group(name=name, description=description, owner_id=user_id)
        owner = User.query.get(user_id)
        if owner:
            new_group.participants.append(owner)

        try:
            db.session.add(new_group)
            db.session.commit()
            return new_group, None
        except Exception as e:
            db.session.rollback()
            return None, str(e)

    @staticmethod
    def join_group(invite_code, user_id):
        group = Group.query.filter_by(invite_code=invite_code).first()
        if not group:
            return None, "Invalid invite code"

        user = User.query.get(user_id)
        if not user:
            return None, "User not found"

        if user in group.participants:
            return None, "Already a participant"

        try:
            group.participants.append(user)
            db.session.commit()
            return group, None
        except Exception as e:
            db.session.rollback()
            return None, str(e)

    @staticmethod
    def get_group_by_id(group_id):
        return Group.query.get(group_id)

    @staticmethod
    def get_user_groups(user_id):
        user = User.query.get(user_id)
        if not user:
            return []

        try:
            from app.services.ollama_service import OllamaService

            OllamaService.ensure_chat_with_ai(user_id)
        except Exception as e:
            print(f"Error ensuring AI chat: {e}")

        return user.groups

    @staticmethod
    def add_participant(
        group_id, target_user_id=None, requester_id=None, target_username=None
    ):
        group = Group.query.get(group_id)
        if not group:
            return None, "Group not found"

        requester = User.query.get(requester_id)
        if not requester or requester not in group.participants:
            return None, "Only participants can add participants"

        user_to_add = None
        if target_user_id:
            user_to_add = User.query.get(target_user_id)
        if not user_to_add and target_username:
            user_to_add = User.query.filter_by(username=target_username).first()

        if not user_to_add:
            return None, "User not found"

        if user_to_add in group.participants:
            return None, "User is already a participant"

        try:
            group.participants.append(user_to_add)
            db.session.commit()
            return group, None
        except Exception as e:
            db.session.rollback()
            return None, str(e)

    @staticmethod
    def is_owner(group_id, user_id):
        group = Group.query.get(group_id)
        if not group:
            return False
        return str(group.owner_id) == str(user_id)

    @staticmethod
    def update_group(group_id, data):
        group = Group.query.get(group_id)
        if not group:
            return None, "Group not found"
        if data.get("name") is not None:
            group.name = data["name"]
        if data.get("description") is not None:
            group.description = data["description"]
        if data.get("avatar_url") is not None:
            group.avatar_url = data["avatar_url"]
        try:
            db.session.commit()
            return group, None
        except Exception as e:
            db.session.rollback()
            return None, str(e)

    @staticmethod
    def leave_group(group_id, user_id):
        group = Group.query.get(group_id)
        if not group:
            return None, "Group not found"
        user = User.query.get(user_id)
        if not user:
            return None, "User not found"
        if user not in group.participants:
            return None, "Not a participant"
        try:
            group.participants.remove(user)
            db.session.commit()
            return group, None
        except Exception as e:
            db.session.rollback()
            return None, str(e)

    @staticmethod
    def search_groups(query, user_id):
        user = User.query.get(user_id)
        if not user:
            return []
        results = Group.query.filter(
            (Group.name.ilike(f"%{query}%")) | (Group.description.ilike(f"%{query}%"))
        ).all()
        return [g for g in results if user not in g.participants]
