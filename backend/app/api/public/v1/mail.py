"""Публичный Mail API (/api/public/v1/mail)."""

from app.services.mail_api_service import (
    get_mail_api_permissions,
    get_mail_client_for_user,
    parse_recipients,
    send_noreply_message,
    send_via_user_mailbox,
    verify_noreply_api_password,
)
from app.services.mailbox_service import MailboxService
from app.utils.mail_api_decorators import mail_api_key_only, mail_api_key_required
from flask import Blueprint, jsonify, request

public_mail_bp = Blueprint(
    "public_mail", __name__, url_prefix="/api/public/v1/mail"
)


def _send_payload(data: dict) -> tuple[list[str], str, str, str | None, list[str] | None]:
    to_addrs = parse_recipients(data.get("to"))
    if not to_addrs:
        raise ValueError("Поле to обязательно")
    subject = (data.get("subject") or "").strip() or "(без темы)"
    body_text = (data.get("body") or data.get("body_text") or "").strip()
    body_html = data.get("body_html")
    if body_html is not None:
        body_html = str(body_html).strip() or None
    cc = parse_recipients(data.get("cc")) or None
    if not body_text and not body_html:
        raise ValueError("Текст письма обязателен (body/body_text или body_html)")
    return to_addrs, subject, body_text or "(пусто)", body_html, cc


@public_mail_bp.route("/send", methods=["POST"])
@mail_api_key_required("send")
def api_send(current_user):
    try:
        data = request.get_json() or {}
        to_addrs, subject, body_text, body_html, cc = _send_payload(data)
        send_via_user_mailbox(
            current_user,
            to_addrs=to_addrs,
            subject=subject,
            body_text=body_text,
            body_html=body_html,
            cc=cc,
        )
        box = MailboxService.get_for_user(current_user.id)
        return jsonify(
            {
                "ok": True,
                "from": box.address if box else None,
            }
        ), 200
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 502


@public_mail_bp.route("/messages", methods=["GET"])
@mail_api_key_required("read")
def api_list_messages(current_user):
    client = get_mail_client_for_user(current_user)
    if not client:
        return jsonify({"error": "Почтовый ящик не подключён"}), 404
    folder = request.args.get("folder") or "INBOX"
    limit = int(request.args.get("limit") or 50)
    offset = int(request.args.get("offset") or 0)
    try:
        messages = client.list_messages(
            folder=folder, limit=limit, offset=offset
        )
        return jsonify({"messages": messages, "folder": folder}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 502


@public_mail_bp.route("/messages/<uid>", methods=["GET"])
@mail_api_key_required("read")
def api_get_message(current_user, uid):
    client = get_mail_client_for_user(current_user)
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


@public_mail_bp.route("/messages/<uid>/trash", methods=["POST"])
@mail_api_key_required("delete")
def api_trash_message(current_user, uid):
    client = get_mail_client_for_user(current_user)
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


@public_mail_bp.route("/permissions", methods=["GET"])
@mail_api_key_only
def api_get_permissions(current_user):
    box = MailboxService.get_for_user(current_user.id)
    return jsonify(
        {
            "permissions": get_mail_api_permissions(current_user),
            "mailbox": box.address if box else None,
        }
    ), 200


@public_mail_bp.route("/noreply/send", methods=["POST"])
def noreply_send():
    """Отправка с noreply@vondic.ru — только пароль (не API ключ)."""
    data = request.get_json() or {}
    password = (data.get("password") or "").strip()
    if not password:
        return jsonify({"error": "Поле password обязательно"}), 400
    if not verify_noreply_api_password(password):
        return jsonify({"error": "Неверный пароль noreply"}), 401
    try:
        to_addrs, subject, body_text, body_html, _cc = _send_payload(data)
        send_noreply_message(
            to_addrs=to_addrs,
            subject=subject,
            body_text=body_text,
            body_html=body_html,
        )
        return jsonify({"ok": True, "from": "noreply@vondic.ru"}), 200
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 502
