from app.schemas.friendship_schema import friendship_schema
from app.services.friendship_service import FriendshipService
from app.utils.decorators import token_required
from flask import Blueprint, jsonify, request

friends_bp = Blueprint("friends", __name__, url_prefix="/api/v1/friends")

@friends_bp.route("/list", methods=["POST"])
@token_required
def get_friends(current_user):
    data = request.get_json() or {}
    target_user_id = data.get("user_id") or current_user.id
    friends = FriendshipService.get_friends(target_user_id)
    return jsonify(friends), 200

@friends_bp.route("/requests", methods=["POST"])
@token_required
def get_requests(current_user):
    data = request.get_json() or {}
    user_id = data.get("user_id")

    if not user_id:
        return jsonify({"error": "user_id is required"}), 400

    if str(user_id) != str(current_user.id):
        if current_user.role != "Admin":
            return jsonify({"error": "User ID mismatch"}), 403

    requests = FriendshipService.get_pending_requests(user_id)
    return jsonify(requests), 200

@friends_bp.route("/request", methods=["POST"])
@token_required
def send_request(current_user):
    data = request.get_json() or {}
    friend_id = data.get("friend_id")
    if not friend_id:
        return jsonify({"error": "friend_id is required"}), 400

    friendship, error = FriendshipService.send_request(
        current_user.id, friend_id)
    if error:
        return jsonify({"error": error}), 400

    return jsonify(friendship_schema.dump(friendship)), 201

@friends_bp.route("/accept", methods=["POST"])
@token_required
def accept_request(current_user):
    data = request.get_json() or {}
    requester_id = data.get("requester_id")
    if not requester_id:
        return jsonify({"error": "requester_id is required"}), 400

    friendship, error = FriendshipService.accept_request(
        current_user.id, requester_id)
    if error:
        return jsonify({"error": error}), 400

    return jsonify(friendship_schema.dump(friendship)), 200

@friends_bp.route("/reject", methods=["POST"])
@token_required
def reject_request(current_user):
    data = request.get_json() or {}
    requester_id = data.get("requester_id")
    if not requester_id:
        return jsonify({"error": "requester_id is required"}), 400

    success, error = FriendshipService.reject_request(
        current_user.id, requester_id)
    if error:
        return jsonify({"error": error}), 400

    return jsonify({"message": "Request rejected"}), 200

@friends_bp.route("/remove", methods=["POST"])
@token_required
def remove_friend(current_user):
    data = request.get_json() or {}
    friend_id = data.get("friend_id")
    if not friend_id:
        return jsonify({"error": "friend_id is required"}), 400

    success, error = FriendshipService.remove_friend(
        current_user.id, friend_id)
    if error:
        return jsonify({"error": error}), 400

    return jsonify({"message": "Friend removed"}), 200
