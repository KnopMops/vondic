import os
import sqlite3
import time
from typing import Optional, Tuple

import requests
from app.core.config import Config
from app.utils.decorators import token_required
from flask import Blueprint, jsonify, request

support_bp = Blueprint("support", __name__, url_prefix="/api/v1/support")

DB_PATH = os.path.join(Config.BASE_DIR, "database.db")
DEFAULT_RAG_API_URL = os.environ.get(
    "RAG_API_URL", "http://127.0.0.1:8001/ask")


def ensure_support_tables():
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute(
        "CREATE TABLE IF NOT EXISTS escalations (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT, question TEXT, created_at INTEGER, status TEXT, answer TEXT, answered_at INTEGER, delivered_user INTEGER DEFAULT 0)"
    )
    cur.execute(
        "CREATE TABLE IF NOT EXISTS escalation_messages (id INTEGER PRIMARY KEY AUTOINCREMENT, escalation_id INTEGER, content TEXT, created_at INTEGER, delivered_user INTEGER DEFAULT 0, sender TEXT DEFAULT 'admin', delivered_admin INTEGER DEFAULT 0)"
    )
    cur.execute(
        "CREATE TABLE IF NOT EXISTS notifications (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT, message TEXT, created_at INTEGER, delivered INTEGER DEFAULT 0)"
    )
    conn.commit()
    conn.close()


ensure_support_tables()


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
        resp = requests.post(DEFAULT_RAG_API_URL, json={
                             "question": question}, timeout=60)
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
    ts = int(time.time())
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute(
        "INSERT INTO escalations (user_id, question, created_at, status) VALUES (?, ?, ?, ?)",
        (user_id, question, ts, "pending"),
    )
    esc_id = cur.lastrowid
    conn.commit()
    conn.close()
    return esc_id


def notify_admin(user_id: str, msg: str):
    ts = int(time.time())
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute(
        "INSERT INTO notifications (user_id, message, created_at, delivered) VALUES (?, ?, ?, ?)",
        (user_id, msg, ts, 0),
    )
    conn.commit()
    conn.close()


@support_bp.route("/chat/send", methods=["POST"])
@token_required
def chat_send(current_user):
    data = request.get_json(force=True) or {}
    question = str(data.get("message", "")).strip()
    esc_id_param = data.get("esc_id")
    new_chat = bool(data.get("new_chat"))
    if not question:
        return jsonify({"ok": False, "error": "Пустое сообщение"}), 400
    ts = int(time.time())
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    if esc_id_param:
        try:
            esc_id_val = int(esc_id_param)
        except Exception:
            conn.close()
            return jsonify({"ok": False, "error": "Invalid esc_id"}), 400
        cur.execute(
            "SELECT user_id, status FROM escalations WHERE id = ?", (esc_id_val,))
        row = cur.fetchone()
        if not row:
            conn.close()
            return jsonify({"ok": False, "error": "Escalation not found"}), 404
        owner_id, status = row
        if str(owner_id) != str(current_user.id):
            conn.close()
            return jsonify({"ok": False, "error": "Forbidden"}), 403
        if (status or "").lower() == "closed":
            conn.close()
            return jsonify({"ok": False, "error": "Chat is closed"}), 400
        cur.execute(
            "INSERT INTO escalation_messages (escalation_id, content, created_at, delivered_user, sender, delivered_admin) VALUES (?, ?, ?, ?, ?, ?)",
            (esc_id_val, question, ts, 1, "user", 0),
        )
        conn.commit()
        conn.close()
        return jsonify({"ok": True, "answer": "Сообщение отправлено оператору", "escalation_id": esc_id_val})
    if new_chat:
        cur.execute(
            "SELECT COUNT(*) FROM escalations WHERE user_id = ? AND status != 'closed'",
            (current_user.id,),
        )
        cnt = int(cur.fetchone()[0])
        if cnt >= 5:
            conn.close()
            return jsonify({"ok": False, "error": "Chat limit reached (5)"}), 400
        esc_id = save_escalation(current_user.id, question)
        notify_admin(current_user.id, f"Новая заявка #{esc_id}: {question}")
        cur.execute(
            "INSERT INTO escalation_messages (escalation_id, content, created_at, delivered_user, sender, delivered_admin) VALUES (?, ?, ?, ?, ?, ?)",
            (esc_id, question, ts, 1, "user", 0),
        )
        cur.execute(
            "INSERT INTO escalation_messages (escalation_id, content, created_at, delivered_user, sender, delivered_admin) VALUES (?, ?, ?, ?, ?, ?)",
            (esc_id, "Перевожу на оператора. Ожидайте ответа.", ts, 0, "bot", 0),
        )
        cur.execute(
            "INSERT INTO escalation_messages (escalation_id, content, created_at, delivered_user, sender, delivered_admin) VALUES (?, ?, ?, ?, ?, ?)",
            (esc_id, f"Новая заявка #{esc_id}: {question}", ts, 0, "bot", 0),
        )
        conn.commit()
        conn.close()
        return jsonify({"ok": True, "answer": "Перевожу на оператора. Ожидайте ответа.", "escalation_id": esc_id})
    cur.execute(
        "SELECT id FROM escalations WHERE user_id = ? AND status != 'closed' ORDER BY created_at DESC LIMIT 1",
        (current_user.id,),
    )
    row = cur.fetchone()
    ts = int(time.time())
    if row:
        esc_id = int(row[0])
        cur.execute(
            "INSERT INTO escalation_messages (escalation_id, content, created_at, delivered_user, sender, delivered_admin) VALUES (?, ?, ?, ?, ?, ?)",
            (esc_id, question, ts, 1, "user", 0),
        )
        conn.commit()
        conn.close()
        return jsonify({"ok": True, "answer": "Сообщение отправлено оператору", "escalation_id": esc_id})
    conn.close()

    answer, err = ask_rag(question)
    needs_escalation = bool(err) or is_escalation(question) or is_escalation(
        answer) or is_low_confidence_answer(answer)
    if needs_escalation:
        conn2 = sqlite3.connect(DB_PATH)
        cur2 = conn2.cursor()
        cur2.execute(
            "SELECT COUNT(*) FROM escalations WHERE user_id = ? AND status != 'closed'",
            (current_user.id,),
        )
        cnt = int(cur2.fetchone()[0])
        if cnt >= 5:
            conn2.close()
            return jsonify({"ok": False, "error": "Chat limit reached (5)"}), 400
        esc_id = save_escalation(current_user.id, question)
        notify_admin(current_user.id, f"Новая заявка #{esc_id}: {question}")
        conn2 = sqlite3.connect(DB_PATH)
        cur2 = conn2.cursor()
        cur2.execute(
            "INSERT INTO escalation_messages (escalation_id, content, created_at, delivered_user, sender, delivered_admin) VALUES (?, ?, ?, ?, ?, ?)",
            (esc_id, question, ts, 1, "user", 0),
        )
        cur2.execute(
            "INSERT INTO escalation_messages (escalation_id, content, created_at, delivered_user, sender, delivered_admin) VALUES (?, ?, ?, ?, ?, ?)",
            (esc_id, "Перевожу на оператора. Ожидайте ответа.", ts, 0, "bot", 0),
        )
        cur2.execute(
            "INSERT INTO escalation_messages (escalation_id, content, created_at, delivered_user, sender, delivered_admin) VALUES (?, ?, ?, ?, ?, ?)",
            (esc_id, f"Новая заявка #{esc_id}: {question}", ts, 0, "bot", 0),
        )
        conn2.commit()
        conn2.close()
        return jsonify({"ok": True, "answer": "Перевожу на оператора. Ожидайте ответа.", "escalation_id": esc_id})
    return jsonify({"ok": True, "answer": answer})


@support_bp.route("/chat/updates", methods=["GET"])
@token_required
def chat_updates(current_user):
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute(
        """
        SELECT m.id, e.question, m.content, m.created_at, m.escalation_id, m.sender
        FROM escalation_messages m
        JOIN escalations e ON e.id = m.escalation_id
        WHERE e.user_id = ? AND m.delivered_user = 0
        ORDER BY m.created_at ASC
        """,
        (current_user.id,),
    )
    rows = cur.fetchall()
    updates = [{"id": r[0], "question": r[1],
                "answer": r[2], "answered_at": r[3], "escalation_id": r[4], "sender": r[5] or "admin"} for r in rows]
    if rows:
        ids = [r[0] for r in rows]
        cur.execute(
            f"UPDATE escalation_messages SET delivered_user = 1 WHERE id IN ({','.join('?' for _ in ids)})",
            ids,
        )
        conn.commit()
    conn.close()
    return jsonify({"ok": True, "updates": updates})


@support_bp.route("/chat/history", methods=["GET"])
@token_required
def chat_history(current_user):
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute(
        """
        SELECT m.id, m.sender, m.content, m.created_at, m.escalation_id
        FROM escalation_messages m
        JOIN escalations e ON e.id = m.escalation_id
        WHERE e.user_id = ?
        ORDER BY m.created_at ASC, m.id ASC
        """,
        (current_user.id,),
    )
    rows = cur.fetchall()
    conn.close()
    messages = [
        {"id": r[0], "sender": r[1] or "admin", "content": r[2],
            "created_at": r[3], "escalation_id": r[4]}
        for r in rows
    ]
    return jsonify({"ok": True, "messages": messages})


@support_bp.route("/admin/escalations", methods=["GET"])
@token_required
def admin_escalations(current_user):
    if current_user.role not in ("Support", "Admin"):
        return jsonify({"error": "Forbidden"}), 403
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute(
        "SELECT id, user_id, question, created_at FROM escalations WHERE status != 'closed' ORDER BY created_at DESC"
    )
    escalations = [{"id": r[0], "user_id": r[1], "question": r[2],
                    "created_at": r[3]} for r in cur.fetchall()]
    conn.close()
    return jsonify({"ok": True, "escalations": escalations})


@support_bp.route("/admin/escalations/<int:esc_id>/answer", methods=["POST"])
@token_required
def admin_answer(current_user, esc_id: int):
    if current_user.role not in ("Support", "Admin"):
        return jsonify({"error": "Forbidden"}), 403
    data = request.get_json() or {}
    answer = str(data.get("answer", "")).strip()
    if not answer:
        return jsonify({"error": "Empty answer"}), 400
    ts = int(time.time())
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute(
        "INSERT INTO escalation_messages (escalation_id, content, created_at, delivered_user, sender, delivered_admin) VALUES (?, ?, ?, ?, ?, ?)",
        (esc_id, answer, ts, 0, "admin", 0),
    )
    cur.execute(
        "UPDATE escalations SET status = COALESCE(NULLIF(status, ''), 'open'), answer = ?, answered_at = ? WHERE id = ?",
        (answer, ts, esc_id),
    )
    conn.commit()
    conn.close()
    return jsonify({"ok": True})


@support_bp.route("/admin/escalations/<int:esc_id>/messages", methods=["GET"])
@token_required
def admin_escalation_messages(current_user, esc_id: int):
    if current_user.role not in ("Support", "Admin"):
        return jsonify({"error": "Forbidden"}), 403
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute(
        "SELECT id, sender, content, created_at FROM escalation_messages WHERE escalation_id = ? ORDER BY created_at ASC, id ASC",
        (esc_id,),
    )
    rows = cur.fetchall()
    conn.close()
    messages = [
        {"id": r[0], "sender": r[1] or "admin",
            "content": r[2], "created_at": r[3]}
        for r in rows
    ]
    return jsonify({"ok": True, "messages": messages})


@support_bp.route("/admin/escalations/<int:esc_id>/updates", methods=["GET"])
@token_required
def admin_escalation_updates(current_user, esc_id: int):
    if current_user.role not in ("Support", "Admin"):
        return jsonify({"error": "Forbidden"}), 403
    since_id = int(request.args.get("since_id", "0") or "0")
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    if since_id > 0:
        cur.execute(
            "SELECT id, sender, content, created_at FROM escalation_messages WHERE escalation_id = ? AND id > ? AND sender = 'user' ORDER BY id ASC",
            (esc_id, since_id),
        )
    else:
        cur.execute(
            "SELECT id, sender, content, created_at FROM escalation_messages WHERE escalation_id = ? AND sender = 'user' ORDER BY id ASC",
            (esc_id,),
        )
    rows = cur.fetchall()
    conn.close()
    messages = [
        {"id": r[0], "sender": r[1] or "user",
            "content": r[2], "created_at": r[3]}
        for r in rows
    ]
    return jsonify({"ok": True, "messages": messages})


@support_bp.route("/admin/escalations/<int:esc_id>/close", methods=["POST"])
@token_required
def admin_escalation_close(current_user, esc_id: int):
    if current_user.role not in ("Support", "Admin"):
        return jsonify({"error": "Forbidden"}), 403
    ts = int(time.time())
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute(
        "UPDATE escalations SET status = 'closed' WHERE id = ?", (esc_id,))
    cur.execute("SELECT user_id FROM escalations WHERE id = ?", (esc_id,))
    row = cur.fetchone()
    user_id = row[0] if row else None
    if user_id:
        cur.execute(
            "INSERT INTO notifications (user_id, message, created_at, delivered) VALUES (?, ?, ?, ?)",
            (user_id, "Оператор закрыл обращение", ts, 0),
        )
        cur.execute(
            "INSERT INTO escalation_messages (escalation_id, content, created_at, delivered_user, sender, delivered_admin) VALUES (?, ?, ?, ?, ?, ?)",
            (esc_id, "Оператор закрыл обращение", ts, 0, "bot", 0),
        )
    conn.commit()
    conn.close()
    return jsonify({"ok": True})


@support_bp.route("/chats", methods=["GET"])
@token_required
def user_chats(current_user):
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute(
        "SELECT id, question, status, created_at FROM escalations WHERE user_id = ? ORDER BY created_at DESC",
        (current_user.id,),
    )
    rows = cur.fetchall()
    conn.close()
    chats = [{"id": r[0], "question": r[1], "status": r[2]
              or "open", "created_at": r[3]} for r in rows]
    return jsonify({"ok": True, "chats": chats})


@support_bp.route("/chats/<int:esc_id>/delete", methods=["POST"])
@token_required
def user_chat_delete(current_user, esc_id: int):
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute(
        "SELECT user_id, status FROM escalations WHERE id = ?", (esc_id,))
    row = cur.fetchone()
    if not row:
        conn.close()
        return jsonify({"error": "Not found"}), 404
    owner_id, status = row
    if str(owner_id) != str(current_user.id):
        conn.close()
        return jsonify({"error": "Forbidden"}), 403
    if (status or "").lower() != "closed":
        conn.close()
        return jsonify({"error": "Chat must be closed before delete"}), 400
    cur.execute(
        "DELETE FROM escalation_messages WHERE escalation_id = ?", (esc_id,))
    cur.execute("DELETE FROM escalations WHERE id = ?", (esc_id,))
    conn.commit()
    conn.close()
    return jsonify({"ok": True})
