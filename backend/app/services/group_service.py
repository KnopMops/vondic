from datetime import datetime

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

        new_group = Group(
            name=name,
            description=description,
            owner_id=user_id
        )
        # Add owner to participants automatically
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
        return user.groups

    @staticmethod
    def add_participant(group_id, target_user_id, requester_id):
        group = Group.query.get(group_id)
        if not group:
            return None, "Group not found"

        # Check permissions (only owner can add for now, or maybe any member?)
        # Let's restrict to owner for simplicity/security
        if str(group.owner_id) != str(requester_id):
             # Alternatively, allow if requester is already a participant?
             # For "Add friend to group" usually any member can add, or only admin.
             # Let's allow owner only for now to be safe, or check requirements.
             # User said "add possibility to add participants".
             # Let's allow owner.
            return None, "Only owner can add participants"

        user_to_add = User.query.get(target_user_id)
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
