from app.core.extensions import db
from app.services.mail_api_service import (
    get_mail_api_permissions,
    set_mail_api_permissions,
)
from app.services.mailbox_service import MailboxService
from app.utils.decorators import premium_required, token_required
from flask import Blueprint, jsonify, request

mail_bp = Blueprint("mail", __name__, url_prefix="/api/v1/mail")


@mail_bp.route("/mailbox/suggest", methods=["GET"])
@token_required
@premium_required
def suggest_mailbox_local_part(current_user):
    return jsonify(
        {"local_part": MailboxService.suggest_local_part(current_user)}), 200


@mail_bp.route("/mailbox", methods=["GET"])
@token_required
@premium_required
def get_mailbox(current_user):
    box = MailboxService.get_for_user(current_user.id)
    if not box:
        return jsonify({"mailbox": None}), 200
    return jsonify({"mailbox": MailboxService.mailbox_to_dict(box)}), 200


@mail_bp.route("/mailbox", methods=["POST"])
@token_required
@premium_required
def create_mailbox(current_user):
    data = request.get_json() or {}
    local_part = data.get("local_part") or data.get("username") or ""
    password = data.get("password") or ""
    display_name = data.get("display_name")
    quota_mb = int(data.get("quota_mb") or 1024)

    box, error, coins_awarded = MailboxService.create_mailbox(
        current_user,
        local_part=local_part,
        password=password,
        display_name=display_name,
        quota_mb=quota_mb,
    )
    if error:
        status = 400
        if "MAIL_PROVISION_ENABLED" in error or "docker" in error.lower():
            status = 503
        return jsonify({"error": error}), status
    return (
        jsonify(
            {
                "mailbox": MailboxService.mailbox_to_dict(box),
                "coins_awarded": coins_awarded,
                "balance": int(current_user.balance or 0),
            }
        ),
        201,
    )


@mail_bp.route("/folders", methods=["GET"])
@token_required
@premium_required
def list_folders(current_user):
    client = MailboxService.get_mail_client(current_user)
    if not client:
        return jsonify({"error": "Почтовый ящик не подключён"}), 404
    try:
        folders = client.list_folders()
        return jsonify({"folders": folders}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 502


@mail_bp.route("/messages", methods=["GET"])
@token_required
@premium_required
def list_messages(current_user):
    client = MailboxService.get_mail_client(current_user)
    if not client:
        return jsonify({"error": "Почтовый ящик не подключён"}), 404
    folder = request.args.get("folder") or "INBOX"
    limit = int(request.args.get("limit") or 50)
    offset = int(request.args.get("offset") or 0)
    try:
        messages = client.list_messages(
            folder=folder, limit=limit, offset=offset)
        return jsonify({"messages": messages, "folder": folder}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 502


@mail_bp.route("/messages/<uid>", methods=["GET"])
@token_required
@premium_required
def get_message(current_user, uid):
    client = MailboxService.get_mail_client(current_user)
    if not client:
        return jsonify({"error": "Почтовый ящик не подключён"}), 404
    folder = request.args.get("folder") or "INBOX"
    try:
        message = client.get_message(folder=folder, uid=uid)
        client.mark_seen(folder=folder, uid=uid)
        message["seen"] = True
        return jsonify({"message": message}), 200
    except ValueError as e:
        return jsonify({"error": str(e)}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 502


@mail_bp.route("/send", methods=["POST"])
@token_required
@premium_required
def send_message(current_user):
    client = MailboxService.get_mail_client(current_user)
    if not client:
        return jsonify({"error": "Почтовый ящик не подключён"}), 404
    data = request.get_json() or {}
    to_raw = data.get("to")
    if not to_raw:
        return jsonify({"error": "Поле to обязательно"}), 400
    if isinstance(to_raw, str):
        to_addrs = [a.strip() for a in to_raw.split(",") if a.strip()]
    else:
        to_addrs = [str(a).strip() for a in to_raw if str(a).strip()]
    subject = (data.get("subject") or "").strip() or "(без темы)"
    body_text = (data.get("body") or data.get("body_text") or "").strip()
    body_html = data.get("body_html")
    cc_raw = data.get("cc")
    cc = None
    if cc_raw:
        cc = (
            [a.strip() for a in cc_raw.split(",") if a.strip()]
            if isinstance(cc_raw, str)
            else [str(a).strip() for a in cc_raw]
        )
    if not body_text and not body_html:
        return jsonify({"error": "Текст письма обязателен"}), 400
    try:
        client.send_message(
            to_addrs=to_addrs,
            subject=subject,
            body_text=body_text or "(пусто)",
            body_html=body_html,
            cc=cc,
        )
        return jsonify({"ok": True}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 502


@mail_bp.route("/messages/<uid>/trash", methods=["POST"])
@token_required
@premium_required
def trash_message(current_user, uid):
    client = MailboxService.get_mail_client(current_user)
    if not client:
        return jsonify({"error": "Почтовый ящик не подключён"}), 404
    folder = request.args.get("folder") or (
        (request.get_json(silent=True) or {}).get("folder") or "INBOX"
    )
    try:
        if not client.move_to_trash(folder=folder, uid=uid):
            return jsonify({"error": "Не удалось переместить в корзину"}), 502
        return jsonify({"ok": True}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 502


@mail_bp.route("/api-permissions", methods=["GET"])
@token_required
@premium_required
def get_api_permissions(current_user):
    return jsonify(
        {"permissions": get_mail_api_permissions(current_user)}), 200


@mail_bp.route("/api-permissions", methods=["PUT"])
@token_required
@premium_required
def update_api_permissions(current_user):
    data = request.get_json() or {}
    perms = set_mail_api_permissions(current_user, data)
    try:
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500
    return jsonify({"permissions": perms}), 200
