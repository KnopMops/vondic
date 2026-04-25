import hashlib
import json
import os
import time
from datetime import datetime
from typing import Optional, Tuple

import requests
from app.core.config import Config
from app.core.extensions import db
from app.models.escalation import Escalation
from app.models.notification import Notification
from app.models.post_report import PostReport
from app.models.post import Post
from app.models.support_chat_message import SupportChatMessage
from app.services.post_service import PostService
from app.utils.decorators import token_required
from flask import Blueprint, jsonify, request

support_bp = Blueprint("support", __name__, url_prefix="/api/v1/support")

DEFAULT_RAG_API_URL = os.environ.get(
    "RAG_API_URL", "http://127.0.0.1:8001/ask")
FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:3000")


def ensure_support_tables():
    try:
        db.create_all()
    except Exception as e:
        db.session.rollback()
        print(f"Error creating support tables: {e}")


def is_escalation(text: str) -> bool:
    t = (text or "").casefold()
    patterns = [
        "перевести на оператора",
        "переведи на оператора",
        "перевожу на оператора",
        "соединяю с оператором",
        "оператору",
    ]
    return any(p in t for p in patterns)


def is_low_confidence_answer(text: str) -> bool:
    t = (text or "").strip().casefold()
    if not t:
        return True
    if t.startswith("вы спросили:"):
        return True
    if "не понимаю" in t or "не могу ответить" in t:
        return True
    return False


def ask_rag(question: str) -> Tuple[str, Optional[str]]:
    try:
        resp = requests.post(
            DEFAULT_RAG_API_URL, json={"question": question}, timeout=60
        )
        if resp.status_code == 200:
            try:
                data = resp.json()
                return data.get("answer", ""), None
            except Exception:
                return resp.text or "", None
        return "", str(resp.status_code)
    except Exception as e2:
        return "", str(e2)


def save_escalation(user_id: str, question: str) -> int:
    escalation = Escalation(
        user_id=user_id,
        question=question,
        status="open",
    )
    db.session.add(escalation)
    db.session.commit()
    return escalation.id


def notify_admin(
        user_id: str,
        msg: str,
        title: str | None = None,
        notification_type: str = "system"):
    content_hash = hashlib.sha256(
        f"{user_id}|{msg}|{time.time()}".encode("utf-8")).hexdigest()
    db.session.add(
        Notification(
            user_id=user_id,
            title=title,
            type=notification_type,
            message=msg,
            notification_hash=content_hash,
        )
    )
    db.session.commit()


def notify_user(
        user_id: str,
        msg: str,
        title: str | None = None,
        notification_type: str = "system"):
    content_hash = hashlib.sha256(
        f"{user_id}|{msg}|{time.time()}".encode("utf-8")).hexdigest()
    db.session.add(
        Notification(
            user_id=user_id,
            title=title,
            type=notification_type,
            message=msg,
            notification_hash=content_hash,
        )
    )
    db.session.commit()


def set_post_report_status(
    report_id: int, status: str, verdict_at: Optional[int] = None
):
    report = PostReport.query.get(report_id)
    if not report:
        return
    report.status = status
    if verdict_at is not None:
        report.verdict_at = verdict_at
    db.session.commit()


def delete_post_report(report_id: int):
    report = PostReport.query.get(report_id)
    if report:
        db.session.delete(report)
    db.session.commit()


@support_bp.route("/chat/send", methods=["POST"])
@token_required
def chat_send(current_user):
    data = request.get_json(force=True) or {}
    question = str(data.get("message", "")).strip()
    esc_id_param = data.get("esc_id")
    new_chat = bool(data.get("new_chat"))
    if not question:
        return jsonify({"ok": False, "error": "Пустое сообщение"}), 400

    if esc_id_param:
        try:
            esc_id_val = int(esc_id_param)
        except Exception:
            return jsonify({"ok": False, "error": "Invalid esc_id"}), 400
        escalation = Escalation.query.get(esc_id_val)
        if not escalation:
            return jsonify({"ok": False, "error": "Обращение не найдено"}), 404
        if str(escalation.user_id) != str(current_user.id):
            return jsonify({"ok": False, "error": "Доступ запрещён"}), 403
        if (escalation.status or "").lower() == "closed":
            return jsonify({"ok": False, "error": "Чат закрыт"}), 400
        db.session.add(
            SupportChatMessage(
                escalation_id=esc_id_val,
                sender="user",
                content=question,
            )
        )
        db.session.commit()
        return jsonify(
            {
                "ok": True,
                "answer": "Сообщение отправлено оператору",
                "escalation_id": esc_id_val,
            }
        )

    if new_chat:
        cnt = Escalation.query.filter(
            Escalation.user_id == current_user.id,
            Escalation.status != "closed",
        ).count()
        if cnt >= 5:
            return jsonify(
                {"ok": False, "error": "Достигнут лимит чатов (5)"}), 400
        esc_id = save_escalation(current_user.id, question)
        notify_admin(current_user.id, f"Новая заявка #{esc_id}: {question}")
        db.session.add(
            SupportChatMessage(
                escalation_id=esc_id,
                sender="user",
                content=question))
        db.session.add(
            SupportChatMessage(
                escalation_id=esc_id,
                sender="support",
                content="Перевожу на оператора. Ожидайте ответа.",
            )
        )
        db.session.add(
            Notification(
                user_id=current_user.id,
                title=f"Новая заявка #{esc_id}",
                message=f"Новая заявка #{esc_id}: {question}",
                type="system",
                notification_hash=hashlib.sha256(
                    f"{current_user.id}|{question}|{time.time()}".encode("utf-8")
                ).hexdigest(),
            )
        )
        db.session.commit()
        return jsonify(
            {
                "ok": True,
                "answer": "Перевожу на оператора. Ожидайте ответа.",
                "escalation_id": esc_id,
            }
        )

    last_open = (
        Escalation.query.filter(
            Escalation.user_id == current_user.id,
            Escalation.status != "closed",
        )
        .order_by(Escalation.created_at.desc())
        .first()
    )
    if last_open:
        esc_id = int(last_open.id)
        db.session.add(
            SupportChatMessage(
                escalation_id=esc_id,
                sender="user",
                content=question))
        db.session.commit()
        return jsonify(
            {
                "ok": True,
                "answer": "Сообщение отправлено оператору",
                "escalation_id": esc_id,
            }
        )

    answer, err = ask_rag(question)
    needs_escalation = (
        bool(err)
        or is_escalation(question)
        or is_escalation(answer)
        or is_low_confidence_answer(answer)
    )
    if needs_escalation:
        cnt = Escalation.query.filter(
            Escalation.user_id == current_user.id,
            Escalation.status != "closed",
        ).count()
        if cnt >= 5:
            return jsonify(
                {"ok": False, "error": "Достигнут лимит чатов (5)"}), 400
        esc_id = save_escalation(current_user.id, question)
        notify_admin(current_user.id, f"Новая заявка #{esc_id}: {question}")
        db.session.add(
            SupportChatMessage(
                escalation_id=esc_id,
                sender="user",
                content=question))
        db.session.add(
            SupportChatMessage(
                escalation_id=esc_id,
                sender="support",
                content="Перевожу на оператора. Ожидайте ответа.",
            )
        )
        db.session.add(
            Notification(
                user_id=current_user.id,
                title=f"Новая заявка #{esc_id}",
                message=f"Новая заявка #{esc_id}: {question}",
                type="system",
                notification_hash=hashlib.sha256(
                    f"{current_user.id}|{question}|{time.time()}".encode("utf-8")
                ).hexdigest(),
            )
        )
        db.session.commit()
        return jsonify(
            {
                "ok": True,
                "answer": "Перевожу на оператора. Ожидайте ответа.",
                "escalation_id": esc_id,
            }
        )
    return jsonify({"ok": True, "answer": answer})


@support_bp.route("/chat/updates", methods=["GET"])
@token_required
def chat_updates(current_user):
    rows = (
        db.session.query(
            SupportChatMessage,
            Escalation) .join(
            Escalation,
            SupportChatMessage.escalation_id == Escalation.id) .filter(
                Escalation.user_id == current_user.id,
                SupportChatMessage.read.is_(False)) .order_by(
                    SupportChatMessage.created_at.asc()) .all())
    updates = [
        {
            "id": msg.id,
            "question": esc.question,
            "answer": msg.content,
            "answered_at": msg.created_at,
            "escalation_id": esc.id,
            "sender": msg.sender or "admin",
        }
        for msg, esc in rows
    ]
    if rows:
        ids = [msg.id for msg, _ in rows]
        SupportChatMessage.query.filter(SupportChatMessage.id.in_(ids)).update(
            {"read": True}, synchronize_session=False
        )
        db.session.commit()
    return jsonify({"ok": True, "updates": updates})


@support_bp.route("/notifications/updates", methods=["GET"])
@token_required
def notifications_updates(current_user):
    rows = (
        Notification.query.filter_by(user_id=current_user.id, is_read=0)
        .order_by(Notification.created_at.desc())
        .all()
    )
    notifications = [
        {
            "id": n.id,
            "title": n.title,
            "type": n.type,
            "message": n.message,
            "created_at": n.created_at,
            "notification_hash": n.notification_hash,
        }
        for n in rows
    ]
    if rows:
        for n in rows:
            n.is_read = 1
        db.session.commit()
    return jsonify({"ok": True, "notifications": notifications})


@support_bp.route("/chat/history", methods=["GET"])
@token_required
def chat_history(current_user):
    rows = (
        db.session.query(SupportChatMessage)
        .join(Escalation, SupportChatMessage.escalation_id == Escalation.id)
        .filter(Escalation.user_id == current_user.id)
        .order_by(SupportChatMessage.created_at.desc())
        .limit(50)
        .all()
    )
    messages = [
        {
            "id": m.id,
            "sender": m.sender or "admin",
            "content": m.content,
            "created_at": m.created_at,
            "escalation_id": m.escalation_id,
        }
        for m in rows
    ]
    return jsonify({"ok": True, "messages": messages})


@support_bp.route("/admin/escalations", methods=["GET"])
@token_required
def admin_escalations(current_user):
    role = str(current_user.role or "").strip().lower()
    if role not in ("support", "admin"):
        return jsonify({"error": "Доступ запрещён"}), 403
    result = (
        Escalation.query.filter(Escalation.status != "closed")
        .order_by(Escalation.created_at.desc())
        .all()
    )
    escalations = [
        {"id": r.id, "user_id": r.user_id, "question": r.question, "created_at": r.created_at}
        for r in result
    ]
    return jsonify({"ok": True, "escalations": escalations})


@support_bp.route("/admin/escalations/<int:esc_id>/answer", methods=["POST"])
@token_required
def admin_answer(current_user, esc_id: int):
    role = str(current_user.role or "").strip().lower()
    if role not in ("support", "admin"):
        return jsonify({"error": "Доступ запрещён"}), 403
    data = request.get_json() or {}
    answer = str(data.get("answer", "")).strip()
    if not answer:
        return jsonify({"error": "Пустой ответ"}), 400
    escalation = Escalation.query.get(esc_id)
    if not escalation:
        return jsonify({"error": "Обращение не найдено"}), 404
    db.session.add(
        SupportChatMessage(
            escalation_id=esc_id,
            sender="support",
            content=answer))
    escalation.status = "answered"
    escalation.answered_at = datetime.utcnow()
    db.session.commit()
    return jsonify({"ok": True})


@support_bp.route("/admin/escalations/<int:esc_id>/messages", methods=["GET"])
@token_required
def admin_escalation_messages(current_user, esc_id: int):
    role = str(current_user.role or "").strip().lower()
    if role not in ("support", "admin"):
        return jsonify({"error": "Доступ запрещён"}), 403
    rows = (
        SupportChatMessage.query.filter_by(escalation_id=esc_id)
        .order_by(SupportChatMessage.created_at.asc())
        .all()
    )
    messages = [{"id": r.id,
                 "sender": r.sender or "admin",
                 "content": r.content,
                 "created_at": r.created_at} for r in rows]
    return jsonify({"ok": True, "messages": messages})


@support_bp.route("/admin/escalations/<int:esc_id>/updates", methods=["GET"])
@token_required
def admin_escalation_updates(current_user, esc_id: int):
    role = str(current_user.role or "").strip().lower()
    if role not in ("support", "admin"):
        return jsonify({"error": "Доступ запрещён"}), 403
    since_id = int(request.args.get("since_id", "0") or "0")
    if since_id > 0:
        rows = (
            SupportChatMessage.query.filter(
                SupportChatMessage.escalation_id == esc_id,
                SupportChatMessage.id > since_id,
            )
            .order_by(SupportChatMessage.created_at.asc())
            .all()
        )
    else:
        rows = (
            SupportChatMessage.query.filter_by(escalation_id=esc_id)
            .order_by(SupportChatMessage.created_at.asc())
            .all()
        )
    messages = [{"id": r.id,
                 "sender": r.sender or "user",
                 "content": r.content,
                 "created_at": r.created_at} for r in rows]
    return jsonify({"ok": True, "messages": messages})


@support_bp.route("/admin/escalations/<int:esc_id>/close", methods=["POST"])
@token_required
def admin_escalation_close(current_user, esc_id: int):
    role = str(current_user.role or "").strip().lower()
    if role not in ("support", "admin"):
        return jsonify({"error": "Доступ запрещён"}), 403
    escalation = Escalation.query.get(esc_id)
    if not escalation:
        return jsonify({"error": "Не найдено"}), 404
    escalation.status = "closed"
    user_id = escalation.user_id
    if user_id:
        content_hash = hashlib.sha256(
            f"{user_id}|Оператор закрыл обращение|{
                time.time()}".encode("utf-8")).hexdigest()
        db.session.add(
            Notification(
                user_id=user_id,
                message="Оператор закрыл обращение",
                notification_hash=content_hash,
                type="system",
            )
        )
        db.session.add(
            SupportChatMessage(
                escalation_id=esc_id,
                sender="support",
                content="Оператор закрыл обращение",
            )
        )
    db.session.commit()
    return jsonify({"ok": True})


@support_bp.route("/chats", methods=["GET"])
@token_required
def user_chats(current_user):
    rows = (
        Escalation.query.filter_by(user_id=current_user.id)
        .order_by(Escalation.created_at.desc())
        .all()
    )
    chats = [{"id": r.id,
              "question": r.question,
              "status": r.status or "open",
              "created_at": r.created_at} for r in rows]
    return jsonify({"ok": True, "chats": chats})


@support_bp.route("/chats/<int:esc_id>/delete", methods=["POST"])
@token_required
def user_chat_delete(current_user, esc_id: int):
    escalation = Escalation.query.get(esc_id)
    if not escalation:
        return jsonify({"error": "Не найдено"}), 404
    if str(escalation.user_id) != str(current_user.id):
        return jsonify({"error": "Доступ запрещён"}), 403
    if (escalation.status or "").lower() != "closed":
        return jsonify(
            {"error": "Чат должен быть закрыт перед удалением"}), 400
    SupportChatMessage.query.filter_by(
        escalation_id=esc_id).delete(
        synchronize_session=False)
    db.session.delete(escalation)
    db.session.commit()
    return jsonify({"ok": True})


@support_bp.route("/post-reports", methods=["POST"])
@token_required
def create_post_report(current_user):
    data = request.get_json(force=True) or {}
    post_id = str(data.get("post_id") or "").strip()
    post_author_login = str(data.get("post_author_login") or "").strip()
    description = str(data.get("description") or "").strip()
    attachments = data.get("attachments") or []
    if not post_id or not post_author_login or not description:
        return jsonify({"error": "Отсутствуют обязательные поля"}), 400
    if not isinstance(attachments, list):
        attachments = []
    report = PostReport(
        reporter_id=str(current_user.id),
        reporter_login=str(current_user.username or ""),
        post_id=post_id,
        post_author_login=post_author_login,
        description=description,
        attachments=json.dumps(attachments),
        status="pending",
    )
    db.session.add(report)
    db.session.commit()
    return jsonify({"ok": True, "id": report.id}), 201


@support_bp.route("/admin/post-reports", methods=["GET"])
@token_required
def admin_post_reports(current_user):
    role = str(current_user.role or "").strip().lower()
    if role not in ("support", "admin"):
        return jsonify({"error": "Доступ запрещён"}), 403
    rows = PostReport.query.order_by(PostReport.created_at.desc()).all()
    reports = []
    now_ts = int(time.time())
    updated = False
    for r in rows:
        report_id = r.id
        post_id = r.post_id
        status = r.status or "open"
        verdict_at = r.verdict_at
        if status in ("no_violation", "deleted", "legal_deleted", "closed"):
            r.status = "closed"
            updated = True
            continue
        if status == "removal_requested":
            post = Post.query.filter_by(id=post_id).first()
            if not post or post.deleted:
                r.status = "deleted"
                updated = True
                continue
        if status == "closed":
            continue
        removal_deadline = None
        removal_time_left = None
        if status == "removal_requested":
            if not verdict_at:
                verdict_at = int(
                    r.created_at.timestamp()) if r.created_at else now_ts
            removal_deadline = verdict_at + 86400
            removal_time_left = max(0, removal_deadline - now_ts)
        attachments = []
        try:
            attachments = json.loads(r.attachments or "[]")
        except Exception:
            attachments = []
        reports.append(
            {
                "id": r.id,
                "reporter_id": r.reporter_id,
                "reporter_login": r.reporter_login,
                "post_id": r.post_id,
                "post_author_login": r.post_author_login,
                "description": r.description,
                "attachments": attachments,
                "created_at": r.created_at,
                "status": status,
                "verdict_at": verdict_at,
                "removal_deadline": removal_deadline,
                "removal_time_left": removal_time_left,
            }
        )
    if updated:
        db.session.commit()
    return jsonify({"ok": True, "reports": reports})


@support_bp.route("/admin/post-reports/action", methods=["POST"])
@token_required
def admin_post_report_action(current_user):
    data = request.get_json(force=True) or {}
    action = str(data.get("action") or "").strip().lower()
    post_id = str(data.get("post_id") or "").strip()
    report_id = data.get("report_id")
    reason = str(data.get("reason") or "").strip()

    if not post_id:
        return jsonify({"error": "Требуется post_id"}), 400

    if action not in (
        "request_removal",
        "force_remove",
        "legal_remove",
        "no_violation",
    ):
        return jsonify({"error": "Недопустимое действие"}), 400

    role = str(current_user.role or "").strip().lower()
    if action == "request_removal" and role not in ("support", "admin"):
        return jsonify({"error": "Доступ запрещён"}), 403

    if action in ("force_remove", "legal_remove") and role != "admin":
        return jsonify({"error": "Доступ запрещён"}), 403

    if action == "no_violation":
        if report_id is None:
            return jsonify({"error": "Требуется report_id"}), 400
        try:
            delete_post_report(int(report_id))
        except Exception:
            pass
        return jsonify({"ok": True, "removed": True})

    post = Post.query.filter_by(id=post_id, deleted=False).first()
    if not post:
        return jsonify({"error": "Пост не найден"}), 404

    author_id = str(post.posted_by)
    post_url = f"{FRONTEND_URL}/feed?postId={post_id}"
    status = "open"

    if action == "request_removal":
        if not reason:
            return jsonify({"error": "Требуется причина"}), 400
        msg = (
            "Вы опубликовали пост, нарушающий правила: "
            f"{reason}. Подробнее: {post_url}. "
            "Пожалуйста, удалите контент в течение 24 часов."
        )
        notify_user(author_id, msg)
        status = "removal_requested"
        if report_id is not None:
            try:
                set_post_report_status(
                    int(report_id), status, int(time.time()))
            except Exception:
                pass

    if action == "force_remove":
        if not reason:
            return jsonify({"error": "Требуется причина"}), 400
        _, error = PostService.delete_post_by_admin(
            post_id, current_user.id, reason)
        if error:
            status_code = 404 if error == "Post not found" else 403
            return jsonify({"error": error}), status_code
        msg = (
            "Ваш пост был удален администрацией. "
            f"Подробнее: {post_url}. Причина: {reason}."
        )
        notify_user(author_id, msg)
        status = "deleted"
        if report_id is not None:
            try:
                delete_post_report(int(report_id))
                return jsonify({"ok": True, "removed": True})
            except Exception:
                pass

    if action == "legal_remove":
        legal_reason = reason or "Нарушение законодательства РФ"
        _, error = PostService.delete_post_by_admin(
            post_id, current_user.id, legal_reason
        )
        if error:
            status_code = 404 if error == "Post not found" else 403
            return jsonify({"error": error}), status_code
        status = "legal_deleted"
        if report_id is not None:
            try:
                delete_post_report(int(report_id))
                return jsonify({"ok": True, "removed": True})
            except Exception:
                pass

    if report_id is not None and action != "request_removal":
        try:
            set_post_report_status(int(report_id), status)
        except Exception:
            pass

    return jsonify({"ok": True, "status": status})
