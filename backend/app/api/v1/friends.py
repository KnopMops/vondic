from app.schemas.friendship_schema import friendship_schema
from app.services.friendship_service import FriendshipService
from app.utils.decorators import token_required
from flask import Blueprint, jsonify, request

friends_bp = Blueprint("friends", __name__, url_prefix="/api/v1/friends")


@friends_bp.route("/list", methods=["POST"])
@token_required
def get_friends(current_user):
    """
    Получить список друзей
    ---
    tags:
      - Friends
    parameters:
      - name: body
        in: body
        required: true
        schema:
          type: object
          properties:
            access_token:
              type: string
              required: true
    description: Возвращает список друзей. Если в теле запроса передан user_id, будет возвращен список друзей указанного пользователя.
    responses:
      200:
        description: Список друзей
        schema:
          type: array
          items:
            type: object
            properties:
                id:
                    type: string
                username:
                    type: string
                email:
                    type: string
                balance:
                    type: number
    """
    data = request.get_json() or {}
    target_user_id = data.get("user_id") or current_user.id
    friends = FriendshipService.get_friends(target_user_id)
    return jsonify(friends), 200


@friends_bp.route("/requests", methods=["POST"])
@token_required
def get_requests(current_user):
    """
    Получить входящие заявки в друзья
    ---
    tags:
      - Friends
    parameters:
      - name: body
        in: body
        required: true
        schema:
          type: object
          properties:
            access_token:
              type: string
              required: true
            user_id:
              type: string
              required: true
    description: Возвращает список входящих заявок для пользователя.
    responses:
      200:
        description: Список заявок
      400:
        description: Ошибка (например, user_id не совпадает с токеном)
    """
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
    """
    Отправить заявку в друзья
    ---
    tags:
      - Friends
    parameters:
      - name: body
        in: body
        required: true
        schema:
          type: object
          properties:
            access_token:
              type: string
              required: true
            friend_id:
              type: string
              required: true
    responses:
      201:
        description: Заявка отправлена
      400:
        description: Ошибка
    """
    data = request.get_json() or {}
    friend_id = data.get("friend_id")
    if not friend_id:
        return jsonify({"error": "friend_id is required"}), 400

    friendship, error = FriendshipService.send_request(current_user.id, friend_id)
    if error:
        return jsonify({"error": error}), 400

    return jsonify(friendship_schema.dump(friendship)), 201


@friends_bp.route("/accept", methods=["POST"])
@token_required
def accept_request(current_user):
    """
    Принять заявку в друзья
    ---
    tags:
      - Friends
    parameters:
      - name: body
        in: body
        required: true
        schema:
          type: object
          properties:
            access_token:
              type: string
              required: true
            requester_id:
              type: string
              required: true
    responses:
      200:
        description: Заявка принята
      400:
        description: Ошибка
    """
    data = request.get_json() or {}
    requester_id = data.get("requester_id")
    if not requester_id:
        return jsonify({"error": "requester_id is required"}), 400

    friendship, error = FriendshipService.accept_request(current_user.id, requester_id)
    if error:
        return jsonify({"error": error}), 400

    return jsonify(friendship_schema.dump(friendship)), 200


@friends_bp.route("/reject", methods=["POST"])
@token_required
def reject_request(current_user):
    """
    Отклонить заявку в друзья
    ---
    tags:
      - Friends
    parameters:
      - name: body
        in: body
        required: true
        schema:
          type: object
          properties:
            access_token:
              type: string
              required: true
            requester_id:
              type: string
              required: true
    responses:
      200:
        description: Заявка отклонена
      400:
        description: Ошибка
    """
    data = request.get_json() or {}
    requester_id = data.get("requester_id")
    if not requester_id:
        return jsonify({"error": "requester_id is required"}), 400

    success, error = FriendshipService.reject_request(current_user.id, requester_id)
    if error:
        return jsonify({"error": error}), 400

    return jsonify({"message": "Request rejected"}), 200


@friends_bp.route("/remove", methods=["POST"])
@token_required
def remove_friend(current_user):
    """
    Удалить друга
    ---
    tags:
      - Friends
    parameters:
      - name: body
        in: body
        required: true
        schema:
          type: object
          properties:
            access_token:
              type: string
              required: true
            friend_id:
              type: string
              required: true
    responses:
      200:
        description: Друг удален
      400:
        description: Ошибка
    """
    data = request.get_json() or {}
    friend_id = data.get("friend_id")
    if not friend_id:
        return jsonify({"error": "friend_id is required"}), 400

    success, error = FriendshipService.remove_friend(current_user.id, friend_id)
    if error:
        return jsonify({"error": error}), 400

    return jsonify({"message": "Friend removed"}), 200
