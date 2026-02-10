from app.schemas.group_schema import group_schema, groups_schema
from app.schemas.message_schema import message_schema, messages_schema
from app.services.group_service import GroupService
from app.services.message_service import MessageService
from app.utils.decorators import token_required
from flask import Blueprint, jsonify, request

groups_bp = Blueprint("groups", __name__, url_prefix="/api/v1/groups")


@groups_bp.route("/", methods=["POST"])
@token_required
def create_group(current_user):
    """
    Создать новую группу
    ---
    tags:
      - Groups
    parameters:
      - name: body
        in: body
        required: true
        schema:
          type: object
          properties:
            name:
              type: string
              required: true
            description:
              type: string
            access_token:
              type: string
    responses:
      201:
        description: Группа создана
      400:
        description: Ошибка валидации
    """
    data = request.get_json() or {}
    group, error = GroupService.create_group(data, current_user.id)
    if error:
        return jsonify({"error": error}), 400
    return jsonify(group_schema.dump(group)), 201


@groups_bp.route("/join", methods=["POST"])
@token_required
def join_group(current_user):
    """
    Вступить в группу по коду приглашения
    ---
    tags:
      - Groups
    parameters:
      - name: body
        in: body
        required: true
        schema:
          type: object
          properties:
            invite_code:
              type: string
              required: true
            access_token:
              type: string
    responses:
      200:
        description: Успешное вступление
      400:
        description: Ошибка (неверный код или уже участник)
    """
    data = request.get_json() or {}
    invite_code = data.get("invite_code")

    if not invite_code:
        return jsonify({"error": "invite_code is required"}), 400

    group, error = GroupService.join_group(invite_code, current_user.id)
    if error:
        return jsonify({"error": error}), 400
    return jsonify(group_schema.dump(group)), 200


@groups_bp.route("/my", methods=["POST"])
@token_required
def get_my_groups(current_user):
    """
    Получить список моих групп
    ---
    tags:
      - Groups
    parameters:
      - name: body
        in: body
        required: true
        schema:
          type: object
          properties:
            access_token:
              type: string
    responses:
      200:
        description: Список групп
        schema:
          type: array
          items:
            $ref: '#/definitions/Group'
    """
    groups = GroupService.get_user_groups(current_user.id)
    return jsonify(groups_schema.dump(groups)), 200


@groups_bp.route("/info", methods=["POST"])
@token_required
def get_group(current_user):
    """
    Получить информацию о группе
    ---
    tags:
      - Groups
    parameters:
      - name: body
        in: body
        required: true
        schema:
          type: object
          properties:
            group_id:
              type: string
              required: true
            access_token:
              type: string
              required: true
    responses:
      200:
        description: Информация о группе
      400:
        description: group_id is required
      404:
        description: Группа не найдена
    """
    data = request.get_json() or {}
    group_id = data.get("group_id")

    if not group_id:
        return jsonify({"error": "group_id is required"}), 400

    group = GroupService.get_group_by_id(group_id)
    if not group:
        return jsonify({"error": "Group not found"}), 404
    return jsonify(group_schema.dump(group)), 200


@groups_bp.route("/<group_id>/participants", methods=["POST"])
@token_required
def add_participant(current_user, group_id):
    """
    Добавить участника в группу
    ---
    tags:
      - Groups
    parameters:
      - name: group_id
        in: path
        type: string
        required: true
      - name: body
        in: body
        required: true
        schema:
          type: object
          properties:
            user_id:
              type: string
              required: true
            access_token:
              type: string
    responses:
      200:
        description: Участник добавлен
      400:
        description: Ошибка
      403:
        description: Нет прав
    """
    data = request.get_json() or {}
    target_user_id = data.get("user_id")

    if not target_user_id:
        return jsonify({"error": "user_id is required"}), 400

    group, error = GroupService.add_participant(
        group_id, target_user_id, current_user.id)
    
    if error:
        status_code = 403 if "Only owner" in error else 400
        return jsonify({"error": error}), status_code

    return jsonify(group_schema.dump(group)), 200


@groups_bp.route("/<group_id>/messages", methods=["POST"])
@token_required
def send_message(current_user, group_id):
    """
    Отправить сообщение в группу
    ---
    tags:
      - Groups
    parameters:
      - name: group_id
        in: path
        type: string
        required: true
      - name: body
        in: body
        required: true
        schema:
          type: object
          properties:
            content:
              type: string
              required: true
            attachments:
              type: array
              items:
                type: object
            type:
              type: string
            access_token:
              type: string
    responses:
      201:
        description: Сообщение отправлено
      400:
        description: Ошибка валидации
      403:
        description: Нет доступа
    """
    data = request.get_json() or {}
    message, error = MessageService.create_message(
        data, current_user.id, group_id)
    if error:
        return jsonify({"error": error}), 400
    return jsonify(message_schema.dump(message)), 201


@groups_bp.route("/<group_id>/messages", methods=["GET"])
@token_required
def get_messages(current_user, group_id):
    """
    Получить сообщения группы (поддерживает пагинацию по курсору)
    ---
    tags:
      - Groups
    parameters:
      - name: group_id
        in: path
        type: string
        required: true
      - name: page
        in: query
        type: integer
        default: 1
      - name: per_page
        in: query
        type: integer
        default: 50
      - name: cursor
        in: query
        type: string
        description: Timestamp (ISO 8601) для подгрузки старых сообщений (created_at < cursor)
      - name: access_token
        in: query
        type: string
    responses:
      200:
        description: Список сообщений
        schema:
          type: object
          properties:
            items:
              type: array
              items:
                $ref: '#/definitions/Message'
            total:
              type: integer
            pages:
              type: integer
            page:
              type: integer
            next_cursor:
              type: string
              description: Timestamp последнего сообщения (используйте для следующего запроса)
    """
    page = request.args.get("page", 1, type=int)
    per_page = request.args.get("per_page", 50, type=int)
    cursor = request.args.get("cursor", type=str)

    messages_pagination, error = MessageService.get_group_messages(
        group_id, current_user.id, page, per_page, cursor
    )

    if error:
        return jsonify({"error": error}), 403

    items = messages_schema.dump(messages_pagination.items)

    # Calculate next_cursor based on the last item if items exist
    next_cursor = None
    if items:
        # Assuming the items are ordered DESC, the last item is the oldest in this batch
        # We need its created_at for the next cursor
        last_item = items[-1]
        next_cursor = last_item.get("created_at")

    return jsonify({
        "items": items,
        "total": messages_pagination.total,
        "pages": messages_pagination.pages,
        "page": messages_pagination.page,
        "next_cursor": next_cursor
    }), 200
