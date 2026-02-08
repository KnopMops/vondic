from app.services.subscription_service import SubscriptionService
from app.utils.decorators import token_required
from flask import Blueprint, jsonify, request

subscriptions_bp = Blueprint(
    "subscriptions", __name__, url_prefix="/api/v1/subscriptions")


@subscriptions_bp.route("/subscribe", methods=["POST"])
@token_required
def subscribe(current_user):
    """
    Подписаться на пользователя
    ---
    tags:
      - Subscriptions
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
            target_id:
              type: string
              required: true
    responses:
      201:
        description: Подписка успешно оформлена
      400:
        description: Ошибка (например, уже подписан)
    """
    data = request.get_json() or {}
    target_id = data.get("target_id")

    if not target_id:
        return jsonify({"error": "target_id is required"}), 400

    sub, error = SubscriptionService.subscribe(current_user.id, target_id)
    if error:
        return jsonify({"error": error}), 400

    return jsonify(sub.to_dict()), 201


@subscriptions_bp.route("/unsubscribe", methods=["POST"])
@token_required
def unsubscribe(current_user):
    """
    Отписаться от пользователя
    ---
    tags:
      - Subscriptions
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
            target_id:
              type: string
              required: true
    responses:
      200:
        description: Успешная отписка
      400:
        description: Ошибка
    """
    data = request.get_json() or {}
    target_id = data.get("target_id")

    if not target_id:
        return jsonify({"error": "target_id is required"}), 400

    success, error = SubscriptionService.unsubscribe(
        current_user.id, target_id)
    if error:
        return jsonify({"error": error}), 400

    return jsonify({"message": "Unsubscribed successfully"}), 200


@subscriptions_bp.route("/followers", methods=["POST"])
@token_required
def get_followers(current_user):
    """
    Получить подписчиков пользователя
    ---
    tags:
      - Subscriptions
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
    responses:
      200:
        description: Список подписчиков
    """
    data = request.get_json() or {}
    user_id = data.get("user_id")

    if not user_id:
        return jsonify({"error": "user_id is required"}), 400

    followers = SubscriptionService.get_followers(user_id)
    return jsonify(followers), 200


@subscriptions_bp.route("/following", methods=["POST"])
@token_required
def get_following(current_user):
    """
    Получить подписки пользователя (на кого он подписан)
    ---
    tags:
      - Subscriptions
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
    responses:
      200:
        description: Список подписок
    """
    data = request.get_json() or {}
    user_id = data.get("user_id")

    if not user_id:
        return jsonify({"error": "user_id is required"}), 400

    following = SubscriptionService.get_following(user_id)
    return jsonify(following), 200
