from app.schemas.community_channel_schema import (
    community_channel_schema,
    community_channels_schema,
)
from app.schemas.community_schema import communities_schema, community_schema
from app.services.community_channel_service import CommunityChannelService
from app.services.community_service import CommunityService
from app.utils.decorators import token_required
from flask import Blueprint, jsonify, request

communities_bp = Blueprint("communities", __name__,
                           url_prefix="/api/v1/communities")

@communities_bp.route("", methods=["POST"])
@token_required
def create_community(current_user):
    data = request.get_json(force=True) or {}
    community, err = CommunityService.create_community(data, current_user.id)
    if err:
        return jsonify({"error": err}), 400
    return jsonify(community_schema.dump(community)), 200

@communities_bp.route("/my", methods=["POST"])
@token_required
def my_communities(current_user):
    items = CommunityService.get_user_communities(current_user.id)
    return jsonify(communities_schema.dump(items)), 200

@communities_bp.route("/<community_id>", methods=["POST"])
@token_required
def community_info(current_user, community_id):
    community = CommunityService.get_by_id(community_id)
    if not community:
        return jsonify({"error": "Community not found"}), 404
    if current_user not in community.members and str(
            community.owner_id) != str(current_user.id):
        return jsonify({"error": "Forbidden"}), 403
    return jsonify(community_schema.dump(community)), 200

@communities_bp.route("/join", methods=["POST"])
@token_required
def join_community(current_user):
    data = request.get_json(force=True) or {}
    invite_code = data.get("invite_code")

    if not invite_code:
        return jsonify({"error": "Invite code is required"}), 400

    community, err = CommunityService.join_community(
        invite_code, current_user.id)
    if err:
        return jsonify({"error": err}), 400

    return jsonify(community_schema.dump(community)), 200

@communities_bp.route("/<community_id>/channels", methods=["POST"])
@token_required
def create_community_channel(current_user, community_id):
    data = request.get_json(force=True) or {}
    channel, err = CommunityChannelService.create_channel(community_id, data)
    if err:
        return jsonify({"error": err}), 400
    return jsonify(community_channel_schema.dump(channel)), 200

@communities_bp.route("/<community_id>/channels", methods=["GET"])
@token_required
def list_community_channels(current_user, community_id):
    items = CommunityChannelService.list_channels(community_id)
    return jsonify(community_channels_schema.dump(items)), 200
