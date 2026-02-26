from app.core.extensions import db
from app.models.channel import Channel
from app.models.community import Community
from app.models.community_channel import CommunityChannel


class CommunityChannelService:
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
            db.session.commit()
            return channel, None
        except Exception as e:
            db.session.rollback()
            return None, str(e)

    @staticmethod
    def list_channels(community_id):
        community = Community.query.get(community_id)
        if not community:
            return []
        return community.channels
