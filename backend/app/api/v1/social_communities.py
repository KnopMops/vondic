from flask import Blueprint, jsonify, request

from app.schemas.social_community_schema import (
    social_communities_schema,
    social_community_schema,
)
from app.services.social_community_service import SocialCommunityService
from app.utils.decorators import token_required

social_communities_bp = Blueprint(
    "social_communities",
    __name__,
    url_prefix="/api/v1/social-communities",
)


@social_communities_bp.route("", methods=["POST"])
@token_required
def create_social_community(current_user):
    data = request.get_json(force=True) or {}
    community, err = SocialCommunityService.create(data, current_user.id)
    if err:
        return jsonify({"error": err}), 400
    return jsonify(social_community_schema.dump(community)), 201


@social_communities_bp.route("/my", methods=["POST"])
@token_required
def my_social_communities(current_user):
    items = SocialCommunityService.get_user_communities(current_user.id)
    return jsonify(social_communities_schema.dump(items)), 200


@social_communities_bp.route("/<community_id>", methods=["POST"])
@token_required
def social_community_info(current_user, community_id):
    community = SocialCommunityService.get_by_id(community_id)
    if not community:
        return jsonify({"error": "Community not found"}), 404
    if not SocialCommunityService.user_is_member(community, current_user):
        if not community.is_public:
            return jsonify({"error": "Forbidden"}), 403
    return jsonify(social_community_schema.dump(community)), 200


@social_communities_bp.route("/join", methods=["POST"])
@token_required
def join_social_community(current_user):
    data = request.get_json(force=True) or {}
    invite_code = data.get("invite_code")
    if not invite_code:
        return jsonify({"error": "invite_code is required"}), 400
    community, err = SocialCommunityService.join(invite_code, current_user.id)
    if err:
        return jsonify({"error": err}), 400
    return jsonify(social_community_schema.dump(community)), 200


@social_communities_bp.route("/leave", methods=["POST"])
@token_required
def leave_social_community(current_user):
    data = request.get_json(force=True) or {}
    community_id = data.get("community_id")
    if not community_id:
        return jsonify({"error": "community_id is required"}), 400
    _, err = SocialCommunityService.leave(community_id, current_user.id)
    if err:
        return jsonify({"error": err}), 400
    return jsonify({"success": True}), 200


@social_communities_bp.route("/<community_id>", methods=["PUT"])
@token_required
def update_social_community(current_user, community_id):
    data = request.get_json(force=True) or {}
    community, err = SocialCommunityService.update(
        community_id, data, current_user.id)
    if err:
        status = 403 if "Only owner" in err else 400
        return jsonify({"error": err}), status
    return jsonify(social_community_schema.dump(community)), 200


@social_communities_bp.route("/search", methods=["POST"])
@token_required
def search_social_communities(current_user):
    data = request.get_json(force=True) or {}
    query = (data.get("query") or "").strip()
    if not query:
        return jsonify({"communities": []}), 200
    results = SocialCommunityService.search(query, current_user.id)
    return jsonify(
        {"communities": social_communities_schema.dump(results)}), 200
