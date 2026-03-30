import hashlib
import json
import os
import time
from typing import Optional, Tuple

import requests
from sqlalchemy import text
from app.core.config import Config
from app.core.extensions import db
from app.models.post import Post
from app.services.post_service import PostService
from app.utils.decorators import token_required
from flask import Blueprint, jsonify, request

support_bp = Blueprint("support", __name__, url_prefix="/api/v1/support")

DEFAULT_RAG_API_URL = os.environ.get(
    "RAG_API_URL", "http://127.0.0.1:8001/ask")
FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:3000")

def ensure_support_tables():

    db.session.execute(text("""
        CREATE TABLE IF NOT EXISTS escalations (
            id SERIAL PRIMARY KEY,
            user_id TEXT NOT NULL,
            question TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            status TEXT DEFAULT 'pending',
            answer TEXT,
            answered_at TIMESTAMP,
            delivered_user BOOLEAN DEFAULT FALSE
        )
    """))

    db.session.execute(text("""
        CREATE TABLE IF NOT EXISTS escalation_messages (
            id SERIAL PRIMARY KEY,
            escalation_id INTEGER NOT NULL REFERENCES escalations(id),
            content TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            delivered_user BOOLEAN DEFAULT FALSE,
            sender TEXT DEFAULT 'admin',
            delivered_admin BOOLEAN DEFAULT FALSE
        )
    """))

    db.session.execute(text("""
        CREATE TABLE IF NOT EXISTS notifications (
            id SERIAL PRIMARY KEY,
            user_id TEXT NOT NULL,
            title TEXT,
            type TEXT,
            message TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            notification_hash TEXT,
            delivered BOOLEAN DEFAULT FALSE
        )
    """))

    db.session.execute(text("""
        CREATE TABLE IF NOT EXISTS post_reports (
            id SERIAL PRIMARY KEY,
            reporter_id TEXT NOT NULL,
            reporter_login TEXT,
            post_id TEXT NOT NULL,
            post_author_login TEXT,
            description TEXT,
            attachments JSONB,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            status TEXT DEFAULT 'open',
            verdict_at TIMESTAMP
        )
    """))

    db.session.commit()

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
    result = db.session.execute(text("""
        INSERT INTO escalations (user_id, question, created_at, status)
        VALUES (:user_id, :question, CURRENT_TIMESTAMP, 'pending')
        RETURNING id
    """), {"user_id": user_id, "question": question})
    esc_id = result.scalar()
    db.session.commit()
    return esc_id

def notify_admin(
        user_id: str,
        msg: str,
        title: str | None = None,
        notification_type: str = "system"):
    content_hash = hashlib.sha256(
        f"{user_id}|{msg}|{time.time()}".encode("utf-8")).hexdigest()
    db.session.execute(text("""
        INSERT INTO notifications (user_id, title, type, message, created_at, delivered, notification_hash)
        VALUES (:user_id, :title, :type, :message, CURRENT_TIMESTAMP, FALSE, :notification_hash)
    """), {
        "user_id": user_id,
        "title": title,
        "type": notification_type,
        "message": msg,
        "notification_hash": content_hash,
    })
    db.session.commit()

def notify_user(
        user_id: str,
        msg: str,
        title: str | None = None,
        notification_type: str = "system"):
    content_hash = hashlib.sha256(
        f"{user_id}|{msg}|{time.time()}".encode("utf-8")).hexdigest()
    db.session.execute(text("""
        INSERT INTO notifications (user_id, title, type, message, created_at, delivered, notification_hash)
        VALUES (:user_id, :title, :type, :message, CURRENT_TIMESTAMP, FALSE, :notification_hash)
    """), {
        "user_id": user_id,
        "title": title,
        "type": notification_type,
        "message": msg,
        "notification_hash": content_hash,
    })
    db.session.commit()

def set_post_report_status(
    report_id: int, status: str, verdict_at: Optional[int] = None
):
    if verdict_at is None:
        db.session.execute(text("""
            UPDATE post_reports SET status = :status WHERE id = :id
        """), {"status": status, "id": report_id})
    else:
        db.session.execute(text("""
            UPDATE post_reports SET status = :status, verdict_at = TO_TIMESTAMP(:verdict_at) WHERE id = :id
        """), {"status": status, "verdict_at": verdict_at, "id": report_id})
    db.session.commit()

def delete_post_report(report_id: int):
    db.session.execute(text("""
        DELETE FROM post_reports WHERE id = :id
    """), {"id": report_id})
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
        result = db.session.execute(text("""
            SELECT user_id, status FROM escalations WHERE id = :id
        """), {"id": esc_id_val})
        row = result.fetchone()
        if not row:
            return jsonify({"ok": False, "error": "Обращение не найдено"}), 404
        owner_id, status = row
        if str(owner_id) != str(current_user.id):
            return jsonify({"ok": False, "error": "Доступ запрещён"}), 403
        if (status or "").lower() == "closed":
            return jsonify({"ok": False, "error": "Чат закрыт"}), 400
        db.session.execute(text("""
            INSERT INTO escalation_messages (escalation_id, content, created_at, delivered_user, sender, delivered_admin)
            VALUES (:escalation_id, :content, CURRENT_TIMESTAMP, TRUE, 'user', FALSE)
        """), {"escalation_id": esc_id_val, "content": question})
        db.session.commit()
        return jsonify(
            {
                "ok": True,
                "answer": "Сообщение отправлено оператору",
                "escalation_id": esc_id_val,
            }
        )

    if new_chat:
        result = db.session.execute(text("""
            SELECT COUNT(*) FROM escalations WHERE user_id = :user_id AND status != 'closed'
        """), {"user_id": current_user.id})
        cnt = int(result.scalar())
        if cnt >= 5:
            return jsonify({"ok": False, "error": "Достигнут лимит чатов (5)"}), 400
        esc_id = save_escalation(current_user.id, question)
        notify_admin(current_user.id, f"Новая заявка #{esc_id}: {question}")
        db.session.execute(text("""
            INSERT INTO escalation_messages (escalation_id, content, created_at, delivered_user, sender, delivered_admin)
            VALUES (:escalation_id, :content, CURRENT_TIMESTAMP, TRUE, 'user', FALSE)
        """), {"escalation_id": esc_id, "content": question})
        db.session.execute(text("""
            INSERT INTO escalation_messages (escalation_id, content, created_at, delivered_user, sender, delivered_admin)
            VALUES (:escalation_id, :content, CURRENT_TIMESTAMP, FALSE, 'bot', FALSE)
        """), {"escalation_id": esc_id, "content": "Перевожу на оператора. Ожидайте ответа."})
        db.session.execute(text("""
            INSERT INTO escalation_messages (escalation_id, content, created_at, delivered_user, sender, delivered_admin)
            VALUES (:escalation_id, :content, CURRENT_TIMESTAMP, FALSE, 'bot', FALSE)
        """), {"escalation_id": esc_id, "content": f"Новая заявка #{esc_id}: {question}"})
        db.session.commit()
        return jsonify(
            {
                "ok": True,
                "answer": "Перевожу на оператора. Ожидайте ответа.",
                "escalation_id": esc_id,
            }
        )

    result = db.session.execute(text("""
        SELECT id FROM escalations WHERE user_id = :user_id AND status != 'closed' ORDER BY created_at DESC LIMIT 1
    """), {"user_id": current_user.id})
    row = result.fetchone()
    if row:
        esc_id = int(row[0])
        db.session.execute(text("""
            INSERT INTO escalation_messages (escalation_id, content, created_at, delivered_user, sender, delivered_admin)
            VALUES (:escalation_id, :content, CURRENT_TIMESTAMP, TRUE, 'user', FALSE)
        """), {"escalation_id": esc_id, "content": question})
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
        result = db.session.execute(text("""
            SELECT COUNT(*) FROM escalations WHERE user_id = :user_id AND status != 'closed'
        """), {"user_id": current_user.id})
        cnt = int(result.scalar())
        if cnt >= 5:
            return jsonify({"ok": False, "error": "Достигнут лимит чатов (5)"}), 400
        esc_id = save_escalation(current_user.id, question)
        notify_admin(current_user.id, f"Новая заявка #{esc_id}: {question}")
        db.session.execute(text("""
            INSERT INTO escalation_messages (escalation_id, content, created_at, delivered_user, sender, delivered_admin)
            VALUES (:escalation_id, :content, CURRENT_TIMESTAMP, TRUE, 'user', FALSE)
        """), {"escalation_id": esc_id, "content": question})
        db.session.execute(text("""
            INSERT INTO escalation_messages (escalation_id, content, created_at, delivered_user, sender, delivered_admin)
            VALUES (:escalation_id, :content, CURRENT_TIMESTAMP, FALSE, 'bot', FALSE)
        """), {"escalation_id": esc_id, "content": "Перевожу на оператора. Ожидайте ответа."})
        db.session.execute(text("""
            INSERT INTO escalation_messages (escalation_id, content, created_at, delivered_user, sender, delivered_admin)
            VALUES (:escalation_id, :content, CURRENT_TIMESTAMP, FALSE, 'bot', FALSE)
        """), {"escalation_id": esc_id, "content": f"Новая заявка #{esc_id}: {question}"})
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
    result = db.session.execute(text("""
        SELECT m.id, e.question, m.content, m.created_at, m.escalation_id, m.sender
        FROM escalation_messages m
        JOIN escalations e ON e.id = m.escalation_id
        WHERE e.user_id = :user_id AND m.delivered_user = FALSE
        ORDER BY m.created_at ASC
    """), {"user_id": current_user.id})
    rows = result.fetchall()
    updates = [
        {
            "id": r[0],
            "question": r[1],
            "answer": r[2],
            "answered_at": r[3],
            "escalation_id": r[4],
            "sender": r[5] or "admin",
        }
        for r in rows
    ]
    if rows:
        ids = [r[0] for r in rows]
        db.session.execute(text("""
            UPDATE escalation_messages SET delivered_user = TRUE WHERE id = ANY(:ids)
        """), {"ids": ids})
        db.session.commit()
    return jsonify({"ok": True, "updates": updates})

@support_bp.route("/notifications/updates", methods=["GET"])
@token_required
def notifications_updates(current_user):
    result = db.session.execute(text("""
        SELECT id, title, type, message, created_at, notification_hash
        FROM notifications
        WHERE user_id = :user_id AND delivered = FALSE
        ORDER BY created_at ASC
    """), {"user_id": current_user.id})
    rows = result.fetchall()
    notifications = [
        {
            "id": r[0],
            "title": r[1],
            "type": r[2],
            "message": r[3],
            "created_at": r[4],
            "notification_hash": r[5],
        }
        for r in rows
    ]
    if rows:
        ids = [r[0] for r in rows]
        db.session.execute(text("""
            UPDATE notifications SET delivered = TRUE WHERE id = ANY(:ids)
        """), {"ids": ids})
        db.session.commit()
    return jsonify({"ok": True, "notifications": notifications})

@support_bp.route("/chat/history", methods=["GET"])
@token_required
def chat_history(current_user):
    result = db.session.execute(text("""
        SELECT m.id, m.sender, m.content, m.created_at, m.escalation_id
        FROM escalation_messages m
        JOIN escalations e ON e.id = m.escalation_id
        WHERE e.user_id = :user_id
        ORDER BY m.created_at ASC, m.id ASC
    """), {"user_id": current_user.id})
    rows = result.fetchall()
    messages = [
        {
            "id": r[0],
            "sender": r[1] or "admin",
            "content": r[2],
            "created_at": r[3],
            "escalation_id": r[4],
        }
        for r in rows
    ]
    return jsonify({"ok": True, "messages": messages})

@support_bp.route("/admin/escalations", methods=["GET"])
@token_required
def admin_escalations(current_user):
    role = str(current_user.role or "").strip().lower()
    if role not in ("support", "admin"):
        return jsonify({"error": "Доступ запрещён"}), 403
    result = db.session.execute(text("""
        SELECT id, user_id, question, created_at FROM escalations WHERE status != 'closed' ORDER BY created_at DESC
    """))
    escalations = [
        {"id": r[0], "user_id": r[1], "question": r[2], "created_at": r[3]}
        for r in result.fetchall()
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
    db.session.execute(text("""
        INSERT INTO escalation_messages (escalation_id, content, created_at, delivered_user, sender, delivered_admin)
        VALUES (:escalation_id, :content, CURRENT_TIMESTAMP, FALSE, 'admin', FALSE)
    """), {"escalation_id": esc_id, "content": answer})
    db.session.execute(text("""
        UPDATE escalations SET status = COALESCE(NULLIF(status, ''), 'open'), answer = :answer, answered_at = CURRENT_TIMESTAMP WHERE id = :id
    """), {"answer": answer, "id": esc_id})
    db.session.commit()
    return jsonify({"ok": True})

@support_bp.route("/admin/escalations/<int:esc_id>/messages", methods=["GET"])
@token_required
def admin_escalation_messages(current_user, esc_id: int):
    role = str(current_user.role or "").strip().lower()
    if role not in ("support", "admin"):
        return jsonify({"error": "Доступ запрещён"}), 403
    result = db.session.execute(text("""
        SELECT id, sender, content, created_at FROM escalation_messages WHERE escalation_id = :esc_id ORDER BY created_at ASC, id ASC
    """), {"esc_id": esc_id})
    rows = result.fetchall()
    messages = [
        {"id": r[0], "sender": r[1] or "admin",
            "content": r[2], "created_at": r[3]}
        for r in rows
    ]
    return jsonify({"ok": True, "messages": messages})

@support_bp.route("/admin/escalations/<int:esc_id>/updates", methods=["GET"])
@token_required
def admin_escalation_updates(current_user, esc_id: int):
    role = str(current_user.role or "").strip().lower()
    if role not in ("support", "admin"):
        return jsonify({"error": "Доступ запрещён"}), 403
    since_id = int(request.args.get("since_id", "0") or "0")
    if since_id > 0:
        result = db.session.execute(text("""
            SELECT id, sender, content, created_at FROM escalation_messages
            WHERE escalation_id = :esc_id AND id > :since_id AND sender = 'user' ORDER BY id ASC
        """), {"esc_id": esc_id, "since_id": since_id})
    else:
        result = db.session.execute(text("""
            SELECT id, sender, content, created_at FROM escalation_messages
            WHERE escalation_id = :esc_id AND sender = 'user' ORDER BY id ASC
        """), {"esc_id": esc_id})
    rows = result.fetchall()
    messages = [
        {"id": r[0], "sender": r[1] or "user",
            "content": r[2], "created_at": r[3]}
        for r in rows
    ]
    return jsonify({"ok": True, "messages": messages})

@support_bp.route("/admin/escalations/<int:esc_id>/close", methods=["POST"])
@token_required
def admin_escalation_close(current_user, esc_id: int):
    role = str(current_user.role or "").strip().lower()
    if role not in ("support", "admin"):
        return jsonify({"error": "Доступ запрещён"}), 403
    db.session.execute(text("""
        UPDATE escalations SET status = 'closed' WHERE id = :id
    """), {"id": esc_id})
    result = db.session.execute(text("""
        SELECT user_id FROM escalations WHERE id = :id
    """), {"id": esc_id})
    row = result.fetchone()
    user_id = row[0] if row else None
    if user_id:
        content_hash = hashlib.sha256(
            f"{user_id}|Оператор закрыл обращение|{time.time()}".encode("utf-8")
        ).hexdigest()
        db.session.execute(text("""
            INSERT INTO notifications (user_id, message, created_at, delivered, notification_hash)
            VALUES (:user_id, :message, CURRENT_TIMESTAMP, FALSE, :notification_hash)
        """), {"user_id": user_id, "message": "Оператор закрыл обращение", "notification_hash": content_hash})
        db.session.execute(text("""
            INSERT INTO escalation_messages (escalation_id, content, created_at, delivered_user, sender, delivered_admin)
            VALUES (:escalation_id, :content, CURRENT_TIMESTAMP, FALSE, 'bot', FALSE)
        """), {"escalation_id": esc_id, "content": "Оператор закрыл обращение"})
    db.session.commit()
    return jsonify({"ok": True})

@support_bp.route("/chats", methods=["GET"])
@token_required
def user_chats(current_user):
    result = db.session.execute(text("""
        SELECT id, question, status, created_at FROM escalations WHERE user_id = :user_id ORDER BY created_at DESC
    """), {"user_id": current_user.id})
    rows = result.fetchall()
    chats = [
        {"id": r[0], "question": r[1], "status": r[2]
            or "open", "created_at": r[3]}
        for r in rows
    ]
    return jsonify({"ok": True, "chats": chats})

@support_bp.route("/chats/<int:esc_id>/delete", methods=["POST"])
@token_required
def user_chat_delete(current_user, esc_id: int):
    result = db.session.execute(text("""
        SELECT user_id, status FROM escalations WHERE id = :id
    """), {"id": esc_id})
    row = result.fetchone()
    if not row:
        return jsonify({"error": "Не найдено"}), 404
    owner_id, status = row
    if str(owner_id) != str(current_user.id):
        return jsonify({"error": "Доступ запрещён"}), 403
    if (status or "").lower() != "closed":
        return jsonify({"error": "Чат должен быть закрыт перед удалением"}), 400
    db.session.execute(text("""
        DELETE FROM escalation_messages WHERE escalation_id = :esc_id
    """), {"esc_id": esc_id})
    db.session.execute(text("""
        DELETE FROM escalations WHERE id = :id
    """), {"id": esc_id})
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
    result = db.session.execute(text("""
        INSERT INTO post_reports (reporter_id, reporter_login, post_id, post_author_login, description, attachments, created_at, status)
        VALUES (:reporter_id, :reporter_login, :post_id, :post_author_login, :description, :attachments, CURRENT_TIMESTAMP, 'open')
        RETURNING id
    """), {
        "reporter_id": str(current_user.id),
        "reporter_login": str(current_user.username or ""),
        "post_id": post_id,
        "post_author_login": post_author_login,
        "description": description,
        "attachments": json.dumps(attachments),
    })
    report_id = result.scalar()
    db.session.commit()
    return jsonify({"ok": True, "id": report_id}), 201

@support_bp.route("/admin/post-reports", methods=["GET"])
@token_required
def admin_post_reports(current_user):
    role = str(current_user.role or "").strip().lower()
    if role not in ("support", "admin"):
        return jsonify({"error": "Доступ запрещён"}), 403
    result = db.session.execute(text("""
        SELECT id, reporter_id, reporter_login, post_id, post_author_login, description, attachments, created_at, status, verdict_at FROM post_reports ORDER BY created_at DESC
    """))
    rows = result.fetchall()
    reports = []
    now_ts = int(time.time())
    updated = False
    for r in rows:
        report_id = r[0]
        post_id = r[3]
        status = r[8] or "open"
        verdict_at = r[9]
        if status in ("no_violation", "deleted", "legal_deleted", "closed"):
            db.session.execute(text("""
                DELETE FROM post_reports WHERE id = :id
            """), {"id": report_id})
            updated = True
            continue
        if status == "removal_requested":
            post = Post.query.filter_by(id=post_id).first()
            if not post or post.deleted:
                db.session.execute(text("""
                    DELETE FROM post_reports WHERE id = :id
                """), {"id": report_id})
                updated = True
                continue
        if status == "closed":
            continue
        removal_deadline = None
        removal_time_left = None
        if status == "removal_requested":
            if not verdict_at:
                verdict_at = r[7] or now_ts
            removal_deadline = verdict_at + 86400
            removal_time_left = max(0, removal_deadline - now_ts)
        attachments = []
        try:
            attachments = json.loads(r[6] or "[]")
        except Exception:
            attachments = []
        reports.append(
            {
                "id": r[0],
                "reporter_id": r[1],
                "reporter_login": r[2],
                "post_id": r[3],
                "post_author_login": r[4],
                "description": r[5],
                "attachments": attachments,
                "created_at": r[7],
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
