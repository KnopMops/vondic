import os
from datetime import datetime

import requests as http_requests
from flask import Blueprint, jsonify, request

from app.api.public.auth_helpers import embed_auth_required, extract_api_key, resolve_realtime_token
from app.core.extensions import db
from app.models.message import Message
from app.schemas.channel_schema import channel_schema, channels_schema
from app.schemas.community_channel_schema import (
    community_channel_schema,
    community_channels_schema,
)
from app.schemas.community_schema import communities_schema, community_schema
from app.schemas.group_schema import group_schema, groups_schema
from app.schemas.message_schema import message_schema, messages_schema
from app.schemas.user_schema import user_schema, users_schema
from app.services.auth_service import AuthService
from app.services.channel_service import ChannelService
from app.services.community_channel_service import CommunityChannelService
from app.services.community_service import CommunityService
from app.services.e2e_key_backup_service import E2EKeyBackupService
from app.services.friendship_service import FriendshipService
from app.services.group_service import GroupService
from app.services.message_service import MessageService
from app.services.user_service import UserService
from app.api.v1.channels import validate_channel_input

public_chat_bp = Blueprint(
    "public_chat", __name__, url_prefix="/api/public/v1/chat"
)


def _webrtc_base_url() -> str:
    return (
        os.getenv("INTERNAL_WEBRTC_URL")
        or os.getenv("WEBRTC_URL")
        or "http://webrtc:5000"
    ).rstrip("/")


def _user_in_community(community, user) -> bool:
    if not community:
        return False
    if str(community.owner_id) == str(user.id):
        return True
    return user in community.members


def _paginated_messages_response(messages_pagination):
    items = messages_schema.dump(messages_pagination.items)
    next_cursor = None
    if items:
        next_cursor = items[-1].get("created_at")
    return {
        "items": items,
        "total": messages_pagination.total,
        "pages": messages_pagination.pages,
        "page": messages_pagination.page,
        "next_cursor": next_cursor,
    }


def _webrtc_proxy(path: str, body: dict, access_token: str | None):
    token = body.pop("token", None) or resolve_realtime_token(access_token)
    if not token:
        return jsonify(
            {"error": "access_token or api_key required for this endpoint"}
        ), 401
    payload = {**body, "token": token}
    try:
        resp = http_requests.post(
            f"{_webrtc_base_url()}{path}",
            json=payload,
            timeout=15,
        )
        try:
            data = resp.json()
        except Exception:
            data = {"error": resp.text or "upstream error"}
        return jsonify(data), resp.status_code
    except http_requests.RequestException as e:
        return jsonify({"error": str(e)}), 502


@public_chat_bp.route("/config", methods=["GET"])
def chat_config():
    return jsonify(
        {
            "api_version": "1",
            "base_path": "/api/public/v1/chat",
            "auth": {
                "methods": ["api_key", "bearer"],
                "api_key_header": "X-API-Key",
                "api_key_query": "api_key",
                "bearer_header": "Authorization: Bearer <access_token>",
            },
            "websocket_url": os.getenv(
                "PUBLIC_WEBRTC_URL",
                os.getenv("WEBRTC_URL", "https://webrtc.vondic.ru"),
            ),
            "features": {
                "direct_messages": True,
                "groups": True,
                "channels": True,
                "communities": True,
                "reactions": True,
                "replies": True,
                "forwards": True,
                "e2e_keys": True,
                "friends": True,
                "uploads": True,
                "realtime": True,
                "voice_calls": True,
            },
        }
    ), 200


@public_chat_bp.route("/me", methods=["GET"])
@embed_auth_required
def chat_me(current_user, access_token):
    data = user_schema.dump(current_user)
    for field in (
        "password_hash",
        "refresh_token",
        "cloud_password_hash",
        "api_key",
        "api_key_hash",
    ):
        data.pop(field, None)
    return jsonify(data), 200


@public_chat_bp.route("/auth/token", methods=["POST"])
@embed_auth_required
def issue_access_token(current_user, access_token):
    if access_token:
        return jsonify({"access_token": access_token,
                       "auth_type": "bearer"}), 200
    api_key = extract_api_key()
    if api_key:
        return jsonify(
            {
                "access_token": api_key,
                "auth_type": "api_key",
                "note": "Use this value as access_token for WebSocket authenticate",
            }
        ), 200
    raw_access, raw_refresh = AuthService._issue_tokens(current_user)
    db.session.commit()
    return jsonify(
        {
            "access_token": raw_access,
            "refresh_token": raw_refresh,
            "auth_type": "bearer",
        }
    ), 200


@public_chat_bp.route("/api-key", methods=["GET"])
@embed_auth_required
def get_api_key(current_user, access_token):
    token, error = UserService.get_api_key(current_user.id)
    if error:
        return jsonify({"error": error}), 400
    if not token:
        return jsonify(
            {"error": "API key not set. Create one via POST /api-key"}), 404
    return jsonify({"api_key": token}), 200


@public_chat_bp.route("/api-key", methods=["POST"])
@embed_auth_required
def create_api_key(current_user, access_token):
    data = request.get_json() or {}
    rotate = bool(data.get("rotate", False))
    token, error = UserService.generate_api_key(current_user.id, rotate=rotate)
    if error:
        return jsonify({"error": error}), 400
    return jsonify({"api_key": token}), 200


@public_chat_bp.route("/contacts/recent", methods=["GET"])
@embed_auth_required
def recent_contacts(current_user, access_token):
    limit = request.args.get("limit", 30, type=int)
    items = MessageService.get_recent_contacts(current_user.id, limit=limit)
    return jsonify({"items": items}), 200


@public_chat_bp.route("/dm/<target_id>/messages", methods=["GET"])
@embed_auth_required
def get_dm_messages(current_user, access_token, target_id):
    page = request.args.get("page", 1, type=int)
    per_page = min(request.args.get("per_page", 50, type=int), 100)
    cursor = request.args.get("cursor", type=str)

    messages_pagination, error = MessageService.get_direct_messages(
        current_user.id, target_id, page, per_page, cursor
    )
    if error:
        return jsonify({"error": error}), 403
    return jsonify(_paginated_messages_response(messages_pagination)), 200


@public_chat_bp.route("/dm/<target_id>/messages", methods=["POST"])
@embed_auth_required
def send_dm_message(current_user, access_token, target_id):
    data = request.get_json() or {}
    message, error = MessageService.create_message(
        data, current_user.id, target_id=target_id
    )
    if error:
        return jsonify({"error": error}), 400

    from app.services.ollama_service import OllamaService

    ai_user = OllamaService.get_ai_user()
    if str(target_id) == str(ai_user.id):
        OllamaService.process_message_async(message.id, is_dm=True)

    return jsonify(message_schema.dump(message)), 201


@public_chat_bp.route(
    "/dm/<target_id>/messages/<message_id>", methods=["DELETE"]
)
@embed_auth_required
def delete_dm_message(current_user, access_token, target_id, message_id):
    message = Message.query.filter(
        Message.id == message_id,
        (((Message.sender_id == current_user.id) & (
            Message.target_id == target_id)) | (
            (Message.sender_id == target_id) & (
                Message.target_id == current_user.id))),
    ).first()
    if not message:
        return jsonify({"error": "Message not found"}), 404
    if str(message.sender_id) != str(current_user.id):
        return jsonify({"error": "Forbidden"}), 403
    db.session.delete(message)
    db.session.commit()
    return jsonify({"message": "deleted"}), 200


@public_chat_bp.route("/dm/<target_id>/history", methods=["DELETE"])
@embed_auth_required
def delete_dm_history(current_user, access_token, target_id):
    deleted = Message.query.filter(
        ((Message.sender_id == current_user.id) & (
            Message.target_id == target_id)) | (
            (Message.sender_id == target_id) & (
                Message.target_id == current_user.id))).delete(
                    synchronize_session=False)
    db.session.commit()
    return jsonify({"deleted": deleted}), 200


@public_chat_bp.route("/groups", methods=["POST"])
@embed_auth_required
def create_group(current_user, access_token):
    data = request.get_json() or {}
    group, error = GroupService.create_group(data, current_user.id)
    if error:
        return jsonify({"error": error}), 400
    return jsonify(group_schema.dump(group)), 201


@public_chat_bp.route("/groups/join", methods=["POST"])
@embed_auth_required
def join_group(current_user, access_token):
    data = request.get_json() or {}
    invite_code = data.get("invite_code")
    if not invite_code:
        return jsonify({"error": "invite_code is required"}), 400
    group, error = GroupService.join_group(invite_code, current_user.id)
    if error:
        return jsonify({"error": error}), 400
    return jsonify(group_schema.dump(group)), 200


@public_chat_bp.route("/groups", methods=["GET"])
@embed_auth_required
def list_groups(current_user, access_token):
    groups = GroupService.get_user_groups(current_user.id)
    return jsonify(groups_schema.dump(groups)), 200


@public_chat_bp.route("/groups/<group_id>", methods=["GET"])
@embed_auth_required
def get_group(current_user, access_token, group_id):
    group = GroupService.get_group_by_id(group_id)
    if not group:
        return jsonify({"error": "Group not found"}), 404
    return jsonify(group_schema.dump(group)), 200


@public_chat_bp.route("/groups/<group_id>/participants", methods=["GET"])
@embed_auth_required
def group_participants(current_user, access_token, group_id):
    group = GroupService.get_group_by_id(group_id)
    if not group:
        return jsonify({"error": "Group not found"}), 404
    return jsonify(users_schema.dump(group.participants)), 200


@public_chat_bp.route("/groups/<group_id>/participants", methods=["POST"])
@embed_auth_required
def add_group_participant(current_user, access_token, group_id):
    data = request.get_json() or {}
    target_user_id = data.get("user_id")
    target_username = data.get("username")
    if not target_user_id and not target_username:
        return jsonify({"error": "user_id or username is required"}), 400
    group, error = GroupService.add_participant(
        group_id,
        target_user_id=target_user_id,
        requester_id=current_user.id,
        target_username=target_username,
    )
    if error:
        status = 403 if "Only participants" in error else 400
        return jsonify({"error": error}), status
    return jsonify(group_schema.dump(group)), 200


@public_chat_bp.route("/groups/<group_id>/messages", methods=["GET"])
@embed_auth_required
def get_group_messages(current_user, access_token, group_id):
    page = request.args.get("page", 1, type=int)
    per_page = min(request.args.get("per_page", 50, type=int), 100)
    cursor = request.args.get("cursor", type=str)
    messages_pagination, error = MessageService.get_group_messages(
        group_id, current_user.id, page, per_page, cursor
    )
    if error:
        return jsonify({"error": error}), 403
    return jsonify(_paginated_messages_response(messages_pagination)), 200


@public_chat_bp.route("/groups/<group_id>/messages", methods=["POST"])
@embed_auth_required
def send_group_message(current_user, access_token, group_id):
    data = request.get_json() or {}
    message, error = MessageService.create_message(
        data, current_user.id, group_id=group_id
    )
    if error:
        return jsonify({"error": error}), 400
    return jsonify(message_schema.dump(message)), 201


@public_chat_bp.route(
    "/groups/<group_id>/messages/<message_id>", methods=["DELETE"]
)
@embed_auth_required
def delete_group_message(current_user, access_token, group_id, message_id):
    from app.models.group import Group

    group = Group.query.get(group_id)
    if not group or current_user not in group.participants:
        return jsonify({"error": "Group not found or access denied"}), 403

    message = Message.query.filter(
        Message.id == message_id, Message.group_id == group_id
    ).first()
    if not message:
        return jsonify({"error": "Message not found"}), 404
    if str(message.sender_id) != str(current_user.id):
        return jsonify({"error": "Forbidden"}), 403

    message.content = "Сообщение удалено"
    message.attachments = []
    message.is_deleted = True
    db.session.commit()
    return jsonify({"message": "deleted"}), 200


@public_chat_bp.route("/groups/<group_id>/history", methods=["DELETE"])
@embed_auth_required
def delete_group_history(current_user, access_token, group_id):
    from app.models.group import Group

    group = Group.query.get(group_id)
    if not group:
        return jsonify({"error": "Group not found"}), 404
    if str(group.owner_id) != str(current_user.id):
        return jsonify({"error": "Only group owner can delete history"}), 403
    deleted = Message.query.filter_by(group_id=group_id).delete(
        synchronize_session=False
    )
    db.session.commit()
    return jsonify({"deleted": deleted}), 200


@public_chat_bp.route("/channels", methods=["POST"])
@embed_auth_required
def create_channel(current_user, access_token):
    data = request.get_json() or {}
    validated, error = validate_channel_input(data)
    if error:
        return jsonify({"error": error}), 400
    channel, error = ChannelService.create_channel(validated, current_user.id)
    if error:
        return jsonify({"error": error}), 400
    return jsonify(channel_schema.dump(channel)), 201


@public_chat_bp.route("/channels/join", methods=["POST"])
@embed_auth_required
def join_channel(current_user, access_token):
    data = request.get_json() or {}
    invite_code = data.get("invite_code")
    if not invite_code:
        return jsonify({"error": "invite_code is required"}), 400
    channel, error = ChannelService.join_channel(invite_code, current_user.id)
    if error:
        return jsonify({"error": error}), 400
    return jsonify(channel_schema.dump(channel)), 200


@public_chat_bp.route("/channels", methods=["GET"])
@embed_auth_required
def list_channels(current_user, access_token):
    channels = ChannelService.get_user_channels(current_user.id)
    return jsonify(channels_schema.dump(channels)), 200


@public_chat_bp.route("/channels/<channel_id>", methods=["GET"])
@embed_auth_required
def get_channel(current_user, access_token, channel_id):
    channel = ChannelService.get_channel_by_id(channel_id)
    if not channel:
        return jsonify({"error": "Channel not found"}), 404
    if current_user not in channel.participants:
        return jsonify({"error": "Access denied"}), 403
    return jsonify(channel_schema.dump(channel)), 200


@public_chat_bp.route("/channels/<channel_id>/messages", methods=["GET"])
@embed_auth_required
def get_channel_messages(current_user, access_token, channel_id):
    page = request.args.get("page", 1, type=int)
    per_page = min(request.args.get("per_page", 50, type=int), 100)
    cursor = request.args.get("cursor", type=str)
    messages_pagination, error = MessageService.get_channel_messages(
        channel_id, current_user.id, page, per_page, cursor
    )
    if error:
        return jsonify({"error": error}), 403
    return jsonify(_paginated_messages_response(messages_pagination)), 200


@public_chat_bp.route("/communities", methods=["POST"])
@embed_auth_required
def create_community(current_user, access_token):
    data = request.get_json() or {}
    community, error = CommunityService.create_community(data, current_user.id)
    if error:
        return jsonify({"error": error}), 400
    return jsonify(community_schema.dump(community)), 201


@public_chat_bp.route("/communities/join", methods=["POST"])
@embed_auth_required
def join_community(current_user, access_token):
    data = request.get_json() or {}
    invite_code = data.get("invite_code")
    if not invite_code:
        return jsonify({"error": "invite_code is required"}), 400
    community, error = CommunityService.join_community(
        invite_code, current_user.id)
    if error:
        return jsonify({"error": error}), 400
    return jsonify(community_schema.dump(community)), 200


@public_chat_bp.route("/communities", methods=["GET"])
@embed_auth_required
def list_communities(current_user, access_token):
    communities = CommunityService.get_user_communities(current_user.id)
    return jsonify(communities_schema.dump(communities)), 200


@public_chat_bp.route("/communities/search", methods=["POST"])
@embed_auth_required
def search_communities(current_user, access_token):
    data = request.get_json() or {}
    query = (data.get("query") or "").strip()
    if not query:
        return jsonify({"items": []}), 200
    results = CommunityService.search_communities(query, current_user.id)
    return jsonify({"items": communities_schema.dump(results)}), 200


@public_chat_bp.route("/communities/<community_id>", methods=["GET"])
@embed_auth_required
def get_community(current_user, access_token, community_id):
    community = CommunityService.get_by_id(community_id)
    if not community:
        return jsonify({"error": "Community not found"}), 404
    if not _user_in_community(community, current_user):
        return jsonify({"error": "Access denied"}), 403
    return jsonify(community_schema.dump(community)), 200


@public_chat_bp.route("/communities/<community_id>", methods=["PUT"])
@embed_auth_required
def update_community(current_user, access_token, community_id):
    community = CommunityService.get_by_id(community_id)
    if not community:
        return jsonify({"error": "Community not found"}), 404
    if str(community.owner_id) != str(current_user.id):
        return jsonify({"error": "Only owner can update community"}), 403
    data = request.get_json() or {}
    community, error = CommunityService.update_community(community_id, data)
    if error:
        return jsonify({"error": error}), 400
    return jsonify(community_schema.dump(community)), 200


@public_chat_bp.route("/communities/leave", methods=["POST"])
@embed_auth_required
def leave_community(current_user, access_token):
    data = request.get_json() or {}
    community_id = data.get("community_id")
    if not community_id:
        return jsonify({"error": "community_id is required"}), 400
    community = CommunityService.get_by_id(community_id)
    if not community:
        return jsonify({"error": "Community not found"}), 404
    if not _user_in_community(community, current_user):
        return jsonify({"error": "You are not a member"}), 403
    _, error = CommunityService.leave_community(community_id, current_user.id)
    if error:
        return jsonify({"error": error}), 400
    return jsonify({"success": True}), 200


@public_chat_bp.route("/communities/<community_id>/invite", methods=["GET"])
@embed_auth_required
def get_community_invite(current_user, access_token, community_id):
    community = CommunityService.get_by_id(community_id)
    if not community:
        return jsonify({"error": "Community not found"}), 404
    if not _user_in_community(community, current_user):
        return jsonify({"error": "Access denied"}), 403
    return jsonify({"invite_code": community.invite_code}), 200


@public_chat_bp.route("/communities/<community_id>/channels", methods=["GET"])
@embed_auth_required
def list_community_channels(current_user, access_token, community_id):
    community = CommunityService.get_by_id(community_id)
    if not community:
        return jsonify({"error": "Community not found"}), 404
    if not _user_in_community(community, current_user):
        return jsonify({"error": "Access denied"}), 403
    channels = CommunityChannelService.list_channels(community_id)
    return jsonify(community_channels_schema.dump(channels)), 200


@public_chat_bp.route("/communities/<community_id>/channels", methods=["POST"])
@embed_auth_required
def create_community_channel(current_user, access_token, community_id):
    community = CommunityService.get_by_id(community_id)
    if not community:
        return jsonify({"error": "Community not found"}), 404
    if not _user_in_community(community, current_user):
        return jsonify({"error": "Access denied"}), 403
    data = request.get_json() or {}
    channel, error = CommunityChannelService.create_channel(community_id, data)
    if error:
        return jsonify({"error": error}), 400
    return jsonify(community_channel_schema.dump(channel)), 201


@public_chat_bp.route("/channels/<channel_id>/messages", methods=["POST"])
@embed_auth_required
def send_channel_message(current_user, access_token, channel_id):
    data = request.get_json() or {}
    message, error = MessageService.create_channel_message(
        data, current_user.id, channel_id
    )
    if error:
        return jsonify({"error": error}), 400
    return jsonify(message_schema.dump(message)), 201


@public_chat_bp.route("/messages/<message_id>/reaction", methods=["POST"])
@embed_auth_required
def add_reaction(current_user, access_token, message_id):
    data = request.get_json() or {}
    emoji = data.get("emoji")
    if not emoji:
        return jsonify({"error": "emoji is required"}), 400

    message = Message.query.get(message_id)
    if not message:
        return jsonify({"error": "Message not found"}), 404
    if not MessageService.user_can_access_message(current_user.id, message):
        return jsonify({"error": "Access denied"}), 403

    reactions = message.reactions or []
    user_reaction = next(
        (
            r
            for r in reactions
            if r.get("user_id") == current_user.id and r.get("emoji") == emoji
        ),
        None,
    )
    if user_reaction:
        reactions = [
            r
            for r in reactions
            if r.get("user_id") != current_user.id or r.get("emoji") != emoji
        ]
        action = "removed"
    else:
        reactions.append(
            {
                "user_id": current_user.id,
                "username": current_user.username,
                "emoji": emoji,
                "created_at": datetime.utcnow().isoformat(),
            }
        )
        action = "added"

    message.reactions = reactions
    db.session.commit()
    return jsonify(
        {"success": True, "reactions": reactions, "action": action}), 200


@public_chat_bp.route("/messages/<message_id>/edit", methods=["PUT"])
@embed_auth_required
def edit_message(current_user, access_token, message_id):
    data = request.get_json() or {}
    new_content = data.get("content")
    if not new_content:
        return jsonify({"error": "content is required"}), 400

    message = Message.query.get(message_id)
    if not message:
        return jsonify({"error": "Message not found"}), 404
    if str(message.sender_id) != str(current_user.id):
        return jsonify({"error": "Forbidden"}), 403
    if (datetime.utcnow() - message.created_at).total_seconds() > 172800:
        return jsonify({"error": "Edit window expired (48h)"}), 400

    edit_history = message.edit_history or []
    edit_history.append({"content": message.content,
                         "edited_at": datetime.utcnow().isoformat()})
    message.content = new_content
    message.is_edited = True
    message.edit_history = edit_history
    message.updated_at = datetime.utcnow()
    db.session.commit()
    return jsonify({"success": True, "message": message.to_dict()}), 200


@public_chat_bp.route("/messages/<message_id>/read", methods=["POST"])
@embed_auth_required
def mark_read(current_user, access_token, message_id):
    message = Message.query.get(message_id)
    if not message:
        return jsonify({"error": "Message not found"}), 404
    if not MessageService.user_can_access_message(current_user.id, message):
        return jsonify({"error": "Access denied"}), 403

    read_by = message.read_by or []
    if not any(r.get("user_id") == current_user.id for r in read_by):
        read_by.append(
            {
                "user_id": current_user.id,
                "username": current_user.username,
                "read_at": datetime.utcnow().isoformat(),
            }
        )
    message.read_by = read_by
    db.session.commit()
    return jsonify({"success": True, "read_by": read_by}), 200


@public_chat_bp.route("/messages/<message_id>/reply", methods=["POST"])
@embed_auth_required
def reply_message(current_user, access_token, message_id):
    data = request.get_json() or {}
    content = data.get("content")
    if not content:
        return jsonify({"error": "content is required"}), 400

    parent = Message.query.get(message_id)
    if not parent:
        return jsonify({"error": "Message not found"}), 404
    if not MessageService.user_can_access_message(current_user.id, parent):
        return jsonify({"error": "Access denied"}), 403

    reply = Message(
        content=content,
        sender_id=current_user.id,
        target_id=parent.target_id,
        group_id=parent.group_id,
        channel_id=parent.channel_id,
        reply_to_id=message_id,
    )
    db.session.add(reply)
    db.session.commit()
    return jsonify({"success": True, "message": reply.to_dict()}), 201


@public_chat_bp.route("/messages/<message_id>/forward", methods=["POST"])
@embed_auth_required
def forward_message(current_user, access_token, message_id):
    data = request.get_json() or {}
    target_id = data.get("target_id")
    group_id = data.get("group_id")
    channel_id = data.get("channel_id")
    if not target_id and not group_id and not channel_id:
        return jsonify(
            {"error": "target_id, group_id or channel_id required"}), 400

    original = Message.query.get(message_id)
    if not original:
        return jsonify({"error": "Message not found"}), 404
    if not MessageService.user_can_access_message(current_user.id, original):
        return jsonify({"error": "Access denied"}), 403

    forwarded = Message(
        content=original.content,
        attachments=original.attachments,
        sender_id=current_user.id,
        target_id=target_id,
        group_id=group_id,
        channel_id=channel_id,
        forwarded_from_id=message_id,
        type=original.type,
    )
    db.session.add(forwarded)
    db.session.commit()
    return jsonify({"success": True, "message": forwarded.to_dict()}), 201


@public_chat_bp.route(
    "/messages/<message_id>/delete-for-everyone", methods=["POST"]
)
@embed_auth_required
def delete_for_everyone(current_user, access_token, message_id):
    message = Message.query.get(message_id)
    if not message:
        return jsonify({"error": "Message not found"}), 404
    if str(
            message.sender_id) != str(
            current_user.id) and current_user.role != "Admin":
        return jsonify({"error": "Forbidden"}), 403
    if (datetime.utcnow() - message.created_at).total_seconds() > 604800:
        return jsonify({"error": "Delete window expired (7d)"}), 400

    message.is_deleted = True
    message.content = "Сообщение удалено"
    message.attachments = []
    message.updated_at = datetime.utcnow()
    db.session.commit()
    return jsonify({"success": True}), 200


@public_chat_bp.route("/friends", methods=["GET"])
@embed_auth_required
def list_friends(current_user, access_token):
    user_id = request.args.get("user_id") or current_user.id
    return jsonify(FriendshipService.get_friends(user_id)), 200


@public_chat_bp.route("/friends/requests", methods=["GET"])
@embed_auth_required
def friend_requests(current_user, access_token):
    requests_list = FriendshipService.get_pending_requests(current_user.id)
    return jsonify(requests_list), 200


@public_chat_bp.route("/friends/request", methods=["POST"])
@embed_auth_required
def send_friend_request(current_user, access_token):
    data = request.get_json() or {}
    friend_id = data.get("friend_id")
    if not friend_id:
        return jsonify({"error": "friend_id is required"}), 400
    from app.schemas.friendship_schema import friendship_schema

    friendship, error = FriendshipService.send_request(
        current_user.id, friend_id)
    if error:
        return jsonify({"error": error}), 400
    return jsonify(friendship_schema.dump(friendship)), 201


@public_chat_bp.route("/friends/accept", methods=["POST"])
@embed_auth_required
def accept_friend(current_user, access_token):
    data = request.get_json() or {}
    requester_id = data.get("requester_id")
    if not requester_id:
        return jsonify({"error": "requester_id is required"}), 400
    friendship, error = FriendshipService.accept_request(
        current_user.id, requester_id
    )
    if error:
        return jsonify({"error": error}), 400
    return jsonify({"success": True}), 200


@public_chat_bp.route("/friends/reject", methods=["POST"])
@embed_auth_required
def reject_friend(current_user, access_token):
    data = request.get_json() or {}
    requester_id = data.get("requester_id")
    if not requester_id:
        return jsonify({"error": "requester_id is required"}), 400
    _, error = FriendshipService.reject_request(current_user.id, requester_id)
    if error:
        return jsonify({"error": error}), 400
    return jsonify({"success": True}), 200


@public_chat_bp.route("/friends/remove", methods=["POST"])
@embed_auth_required
def remove_friend(current_user, access_token):
    data = request.get_json() or {}
    friend_id = data.get("friend_id")
    if not friend_id:
        return jsonify({"error": "friend_id is required"}), 400
    _, error = FriendshipService.remove_friend(current_user.id, friend_id)
    if error:
        return jsonify({"error": error}), 400
    return jsonify({"success": True}), 200


@public_chat_bp.route("/users/search", methods=["POST"])
@embed_auth_required
def search_users(current_user, access_token):
    data = request.get_json() or {}
    query = (data.get("query") or "").strip()
    if not query:
        return jsonify({"items": []}), 200
    users = UserService.search_users(query)
    return (
        jsonify(
            {"items": [u.to_dict(viewer_id=current_user.id) for u in users]}
        ),
        200,
    )


@public_chat_bp.route("/users/<user_id>", methods=["GET"])
@embed_auth_required
def get_user(current_user, access_token, user_id):
    user = UserService.get_user_by_id(user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404
    data = user.to_dict(viewer_id=current_user.id)
    for field in ("password_hash", "api_key", "refresh_token"):
        data.pop(field, None)
    return jsonify(data), 200


@public_chat_bp.route("/presence", methods=["POST"])
@embed_auth_required
def set_presence(current_user, access_token):
    data = request.get_json() or {}
    status = data.get("status")
    if status not in ("online", "offline"):
        return jsonify({"error": "status must be online or offline"}), 400
    current_user.status = status
    db.session.commit()
    return jsonify({"success": True, "status": status}), 200


@public_chat_bp.route("/realtime/dm/history", methods=["POST"])
@embed_auth_required
def realtime_dm_history(current_user, access_token):
    data = dict(request.get_json() or {})
    return _webrtc_proxy(
        "/messages/history",
        {
            "target_id": data.get("target_id"),
            "limit": data.get("limit", 50),
            "offset": data.get("offset", 0),
        },
        resolve_realtime_token(access_token),
    )


@public_chat_bp.route("/realtime/channels/history", methods=["POST"])
@embed_auth_required
def realtime_channel_history(current_user, access_token):
    data = dict(request.get_json() or {})
    return _webrtc_proxy(
        "/channels/history",
        {
            "channel_id": data.get("channel_id"),
            "limit": data.get("limit", 50),
            "offset": data.get("offset", 0),
        },
        resolve_realtime_token(access_token),
    )


@public_chat_bp.route("/realtime/search/chats", methods=["POST"])
@embed_auth_required
def realtime_search_chats(current_user, access_token):
    data = dict(request.get_json() or {})
    return _webrtc_proxy(
        "/chats/search",
        {"query": data.get("query", "")},
        resolve_realtime_token(access_token),
    )


@public_chat_bp.route("/realtime/search/messages", methods=["POST"])
@embed_auth_required
def realtime_search_messages(current_user, access_token):
    data = dict(request.get_json() or {})
    return _webrtc_proxy(
        "/messages/search",
        {
            "target_id": data.get("target_id"),
            "query": data.get("query", ""),
        },
        resolve_realtime_token(access_token),
    )


@public_chat_bp.route("/realtime/online-count", methods=["GET"])
def online_count():
    try:
        resp = http_requests.get(
            f"{_webrtc_base_url()}/api/online-users", timeout=5
        )
        return jsonify(resp.json()), resp.status_code
    except http_requests.RequestException as e:
        return jsonify({"error": str(e)}), 502


@public_chat_bp.route("/e2e-keys/backup", methods=["POST"])
@embed_auth_required
def e2e_backup(current_user, access_token):
    data = request.get_json() or {}
    if not data.get("key_id") or not data.get("encrypted_key_data"):
        return jsonify(
            {"error": "key_id and encrypted_key_data required"}), 400
    backup = E2EKeyBackupService.backup_key(
        user_id=str(current_user.id),
        key_id=data["key_id"],
        encrypted_key_data=data["encrypted_key_data"],
        device_id=data.get("device_id"),
        device_name=data.get("device_name"),
        encryption_algorithm=data.get("encryption_algorithm", "aes-256-gcm"),
    )
    return jsonify(
        {
            "success": True,
            "key_id": backup.key_id,
            "updated_at": backup.updated_at.isoformat() if backup.updated_at else None,
        }
    ), 200


@public_chat_bp.route("/e2e-keys/restore", methods=["POST"])
@embed_auth_required
def e2e_restore(current_user, access_token):
    data = request.get_json() or {}
    if not data.get("key_id"):
        return jsonify({"error": "key_id required"}), 400
    backup = E2EKeyBackupService.get_key(
        user_id=str(current_user.id), key_id=data["key_id"]
    )
    if not backup:
        return jsonify({"error": "Key not found"}), 404
    return jsonify(
        {
            "success": True,
            "key_id": backup.key_id,
            "encrypted_key_data": backup.encrypted_key_data,
            "encryption_algorithm": backup.encryption_algorithm,
            "device_id": backup.device_id,
            "device_name": backup.device_name,
            "updated_at": backup.updated_at.isoformat() if backup.updated_at else None,
        }
    ), 200


@public_chat_bp.route("/e2e-keys/list", methods=["GET"])
@embed_auth_required
def e2e_list(current_user, access_token):
    backups = E2EKeyBackupService.get_all_keys(user_id=str(current_user.id))
    keys = [
        {
            "key_id": b.key_id,
            "device_id": b.device_id,
            "device_name": b.device_name,
            "updated_at": b.updated_at.isoformat() if b.updated_at else None,
        }
        for b in backups
    ]
    return jsonify({"keys": keys, "count": len(keys)}), 200


@public_chat_bp.route("/e2e-keys/delete", methods=["POST"])
@embed_auth_required
def e2e_delete(current_user, access_token):
    data = request.get_json() or {}
    if not data.get("key_id"):
        return jsonify({"error": "key_id required"}), 400
    ok = E2EKeyBackupService.delete_key(
        user_id=str(current_user.id), key_id=data["key_id"]
    )
    if not ok:
        return jsonify({"error": "Key not found"}), 404
    return jsonify({"success": True}), 200


@public_chat_bp.route("/upload/voice", methods=["POST"])
@embed_auth_required
def upload_voice_route(current_user, access_token):
    from app.api.v1.upload import upload_voice

    return upload_voice(current_user)


@public_chat_bp.route("/upload/file", methods=["POST"])
@embed_auth_required
def upload_file_route(current_user, access_token):
    from app.api.v1.upload import upload_file

    return upload_file(current_user)


@public_chat_bp.route("/upload/video", methods=["POST"])
@embed_auth_required
def upload_video_route(current_user, access_token):
    from app.api.v1.upload import upload_video

    return upload_video(current_user)
