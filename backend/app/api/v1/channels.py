from app.schemas.channel_schema import channel_schema, channels_schema
from app.services.channel_service import ChannelService
from app.utils.decorators import token_required
from flask import Blueprint, jsonify, request

channels_bp = Blueprint("channels", __name__, url_prefix="/api/v1/channels")


@channels_bp.route("/", methods=["POST"])
@token_required
def create_channel(current_user):
    data = request.get_json() or {}
    channel, error = ChannelService.create_channel(data, current_user.id)
    if error:
        return jsonify({"error": error}), 400
    return jsonify(channel_schema.dump(channel)), 201


@channels_bp.route("/join", methods=["POST"])
@token_required
def join_channel(current_user):
    data = request.get_json() or {}
    invite_code = data.get("invite_code")

    if not invite_code:
        return jsonify({"error": "invite_code is required"}), 400

    channel, error = ChannelService.join_channel(invite_code, current_user.id)
    if error:
        return jsonify({"error": error}), 400
    return jsonify(channel_schema.dump(channel)), 200


@channels_bp.route("/my", methods=["POST"])
@token_required
def get_my_channels(current_user):
    channels = ChannelService.get_user_channels(current_user.id)
    return jsonify(channels_schema.dump(channels)), 200


@channels_bp.route("/<channel_id>", methods=["POST"])
@token_required
def get_channel_details(current_user, channel_id):
    channel = ChannelService.get_channel_by_id(channel_id)
    if not channel:
        return jsonify({"error": "Channel not found"}), 404
    if current_user not in channel.participants:
        return jsonify({"error": "You are not a member of this channel"}), 403

    return jsonify(channel_schema.dump(channel)), 200
