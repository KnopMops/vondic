from app.core.extensions import ma
from app.models.playlist import Playlist


class PlaylistSchema(ma.SQLAlchemyAutoSchema):
    class Meta:
        model = Playlist
        load_instance = True
        include_fk = True

    track_count = ma.Method("get_track_count")

    def get_track_count(self, obj):
        return len(obj.tracks or [])


playlist_schema = PlaylistSchema()
playlists_schema = PlaylistSchema(many=True)
