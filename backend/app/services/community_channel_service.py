from app.core.extensions import db
from app.models.channel import Channel
from app.models.community import Community
from app.models.community_channel import CommunityChannel
from app.models.user import User


class CommunityChannelService:
    @staticmethod
    def sync_channel_participants(
            community: Community,
            user: User | None = None):
        """Ensure community members are channel participants (text channels are open to all members)."""
        if not community:
            return
        members = list(community.members or [])
        if community.owner:
            owner = community.owner
            if owner not in members:
                members.append(owner)
        if user and user not in members:
            members.append(user)
        for ch in community.channels or []:
            mirror = Channel.query.get(ch.id)
            if not mirror:
                continue
            if mirror.type != "text":
                mirror.type = "text"
            for member in members:
                if member not in mirror.participants:
                    mirror.participants.append(member)
        try:
            db.session.commit()
        except Exception:
            db.session.rollback()

    @staticmethod
    def create_channel(community_id, data):
        name = data.get("name")
        description = data.get("description")
        type_ = (data.get("type") or "text").lower()
        if type_ not in ("text", "voice"):
            return None, "Invalid channel type"
        if not name:
            return None, "Channel name is required"
        community = Community.query.get(community_id)
        if not community:
            return None, "Community not found"
        channel = CommunityChannel(
            community_id=community_id,
            name=name,
            description=description,
            type=type_)
        try:
            db.session.add(channel)
            db.session.flush()

            mirror = Channel(
                id=channel.id,
                name=name,
                description=description,
                owner_id=community.owner_id,
            )
            for member in community.members:
                mirror.participants.append(member)

            db.session.add(mirror)
            db.session.flush()
            CommunityChannelService.sync_channel_participants(community)
            return channel, None
        except Exception as e:
            db.session.rollback()
            return None, str(e)

    @staticmethod
    def list_channels(community_id):
        community = Community.query.get(community_id)
        if not community:
            return []
        CommunityChannelService.sync_channel_participants(community)
        return community.channels
