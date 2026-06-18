from app.schemas.channel_schema import channel_schema, channels_schema
from app.schemas.user_schema import users_schema
from app.services.channel_service import ChannelService
from app.utils.decorators import token_required
from flask import Blueprint, jsonify, request

channels_bp = Blueprint("channels", __name__, url_prefix="/api/v1/channels")


def validate_channel_input(data, require_name=False):
    if not data:
        return None, "Request body is required"

    name = data.get("name")
    description = data.get("description", "")
    avatar_url = data.get("avatar_url")
    channel_type = data.get("type")
    errors = []

    if require_name and not name:
        errors.append("Channel name is required")
    if name is not None:
        if not isinstance(name, str):
            errors.append("Channel name must be a string")
        elif len(name.strip()) == 0:
            errors.append("Channel name cannot be empty")
        elif len(name) > 100:
            errors.append("Channel name must not exceed 100 characters")

    if description and not isinstance(description, str):
        errors.append("Description must be a string")
    elif description and len(description) > 500:
        errors.append("Description must not exceed 500 characters")

    if avatar_url is not None and not isinstance(avatar_url, str):
        errors.append("avatar_url must be a string")

    if channel_type is not None and channel_type not in ("text", "broadcast"):
        errors.append("type must be 'text' or 'broadcast'")

    if errors:
        return None, "; ".join(errors)

    result = {}
    if name is not None:
        result["name"] = name.strip()
    if description is not None:
        result["description"] = description.strip() if description else None
    if avatar_url is not None:
        result["avatar_url"] = avatar_url.strip() if avatar_url else None
    if channel_type is not None:
        result["type"] = channel_type
    return result, None


@channels_bp.route("/", methods=["POST"])
@token_required
def create_channel(current_user):
    try:
        data = request.get_json()

        validated_data, error = validate_channel_input(data, require_name=True)
        if error:
            return jsonify({"error": error, "code": "INVALID_INPUT"}), 400

        channel, error = ChannelService.create_channel(
            validated_data, current_user.id)
        if error:
            if "unique" in error.lower() or "already exists" in error.lower():
                return jsonify(
                    {"error": "Channel with this name already exists", "code": "CHANNEL_EXISTS"}), 409
            if "database" in error.lower() or "sql" in error.lower():
                return jsonify(
                    {"error": "Database error. Please try again later", "code": "DATABASE_ERROR"}), 500
            return jsonify(
                {"error": error, "code": "CHANNEL_CREATE_FAILED"}), 400

        return jsonify(channel_schema.dump(channel)), 201

    except Exception as e:
        return jsonify(
            {"error": f"Internal server error: {str(e)}", "code": "INTERNAL_ERROR"}), 500


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


@channels_bp.route("/<channel_id>", methods=["POST", "GET"])
@token_required
def get_channel_details(current_user, channel_id):
    channel = ChannelService.get_channel_by_id(channel_id)
    if not channel:
        return jsonify({"error": "Channel not found"}), 404
    if current_user not in channel.participants:
        return jsonify({"error": "You are not a member of this channel"}), 403

    return jsonify(channel_schema.dump(channel)), 200


@channels_bp.route("/<channel_id>", methods=["PUT"])
@token_required
def update_channel(current_user, channel_id):
    channel = ChannelService.get_channel_by_id(channel_id)
    if not channel:
        return jsonify({"error": "Channel not found"}), 404
    if not ChannelService.is_owner(channel_id, current_user.id):
        return jsonify({"error": "Only owner can update channel"}), 403

    data = request.get_json() or {}
    validated_data, error = validate_channel_input(data)
    if error:
        return jsonify({"error": error}), 400

    channel, error = ChannelService.update_channel(channel_id, validated_data)
    if error:
        return jsonify({"error": error}), 400
    return jsonify(channel_schema.dump(channel)), 200


@channels_bp.route("/leave", methods=["POST"])
@token_required
def leave_channel(current_user):
    data = request.get_json() or {}
    channel_id = data.get("channel_id")
    if not channel_id:
        return jsonify({"error": "channel_id is required"}), 400

    channel = ChannelService.get_channel_by_id(channel_id)
    if not channel:
        return jsonify({"error": "Channel not found"}), 404
    if current_user not in channel.participants:
        return jsonify({"error": "You are not a member of this channel"}), 403

    channel, error = ChannelService.leave_channel(channel_id, current_user.id)
    if error:
        return jsonify({"error": error}), 400
    return jsonify({"success": True}), 200


@channels_bp.route("/<channel_id>/participants", methods=["GET"])
@token_required
def channel_participants(current_user, channel_id):
    channel = ChannelService.get_channel_by_id(channel_id)
    if not channel:
        return jsonify({"error": "Channel not found"}), 404
    if current_user not in channel.participants:
        return jsonify({"error": "You are not a member of this channel"}), 403
    return jsonify(users_schema.dump(channel.participants)), 200


@channels_bp.route("/search", methods=["POST"])
@token_required
def search_channels(current_user):
    data = request.get_json() or {}
    query = data.get("query", "").strip().lower()
    if not query:
        return jsonify({"channels": []}), 200

    results = ChannelService.search_channels(query, current_user.id)
    return jsonify({"channels": channels_schema.dump(results)}), 200
