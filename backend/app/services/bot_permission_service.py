"""Bot permission/consent service — manages user consent grants to bots."""
import uuid
import logging

logger = logging.getLogger(__name__)

# Default scopes a bot gets without explicit consent
DEFAULT_SCOPES = "basic_profile,send_messages"

# All available scopes with descriptions
SCOPES = {
    "basic_profile": "Basic profile (ID, username, avatar)",
    "read_profile": "Read full profile (name, email, bio)",
    "chat_access": "Access to user's chat list",
    "message_history": "Read message history",
    "send_messages": "Send messages to user",
    "media_access": "Send photos, videos, documents",
    "location_access": "Read geolocation",
    "notifications": "Push notifications",
}


class BotPermissionService:

    @staticmethod
    def get_user_scopes(bot_id: str, user_id: str) -> str:
        """Get granted scopes for a user-bot pair. Returns empty string if no consent."""
        from app.models.bot_user_permission import BotUserPermission
        perm = BotUserPermission.query.filter_by(bot_id=bot_id, user_id=user_id).first()
        if perm:
            return perm.scopes
        return ""

    @staticmethod
    def has_scope(bot_id: str, user_id: str, scope: str) -> bool:
        """Check if user has granted a specific scope to the bot."""
        scopes = BotPermissionService.get_user_scopes(bot_id, user_id)
        return scope in scopes.split(",") if scopes else False

    @staticmethod
    def grant_scopes(bot_id: str, user_id: str, scopes: str = None):
        """Grant scopes to a user for a bot. Creates or updates consent."""
        from app.models.bot_user_permission import BotUserPermission
        from app.core.extensions import db

        if scopes is None:
            scopes = DEFAULT_SCOPES

        perm = BotUserPermission.query.filter_by(bot_id=bot_id, user_id=user_id).first()
        if perm:
            # Merge scopes
            existing = set(perm.scopes.split(",")) if perm.scopes else set()
            new = set(scopes.split(",")) if scopes else set()
            perm.scopes = ",".join(sorted(existing | new))
        else:
            perm = BotUserPermission(
                id=str(uuid.uuid4()),
                bot_id=bot_id,
                user_id=user_id,
                scopes=scopes,
            )
            db.session.add(perm)

        db.session.commit()
        logger.info("bot_permission_granted bot_id=%s user_id=%s scopes=%s", bot_id, user_id, perm.scopes)
        return perm

    @staticmethod
    def revoke_scopes(bot_id: str, user_id: str):
        """Revoke all permissions for a user-bot pair."""
        from app.models.bot_user_permission import BotUserPermission
        from app.core.extensions import db

        perm = BotUserPermission.query.filter_by(bot_id=bot_id, user_id=user_id).first()
        if perm:
            db.session.delete(perm)
            db.session.commit()
            logger.info("bot_permission_revoked bot_id=%s user_id=%s", bot_id, user_id)
            return True
        return False

    @staticmethod
    def get_all_permissions(bot_id: str):
        """Get all user permissions for a bot."""
        from app.models.bot_user_permission import BotUserPermission
        perms = BotUserPermission.query.filter_by(bot_id=bot_id).all()
        return [
            {"user_id": p.user_id, "scopes": p.scopes, "granted_at": str(p.granted_at)}
            for p in perms
        ]

    @staticmethod
    def batch_check(bot_id: str, user_ids: list):
        """Check permissions for multiple users at once."""
        from app.models.bot_user_permission import BotUserPermission
        perms = BotPermissionService.get_user_scopes  # placeholder
        result = {}
        for uid in user_ids:
            result[uid] = BotPermissionService.get_user_scopes(bot_id, uid)
        return result
