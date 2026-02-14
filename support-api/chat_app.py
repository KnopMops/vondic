import importlib.util
import os
import sqlite3
import time
from typing import Optional, Tuple

import requests
from flasgger import Swagger
from flask import (
    Flask,
    jsonify,
    redirect,
    render_template,
    request,
    send_from_directory,
    session,
    url_for,
)
from flask_cors import CORS

APP_SECRET = os.environ.get("CHAT_APP_SECRET", "dev-secret")
DEFAULT_RAG_API_URL = os.environ.get(
    "RAG_API_URL", "http://127.0.0.1:8001/ask")
RAG_MODULE_PATH = os.environ.get("RAG_MODULE_PATH") or os.path.join(
    os.path.dirname(__file__), "Rag-systems", "rag.py")
DB_PATH = os.path.join(os.path.dirname(
    os.path.dirname(__file__)), "database.db")
UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "uploaded_data")


def _load_rag_module(module_path: str):
    spec = importlib.util.spec_from_file_location("rag_module", module_path)
    if spec is None or spec.loader is None:
        return None
    rag = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(rag)
    return rag


rag_module = _load_rag_module(RAG_MODULE_PATH)


def init_db():
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS escalations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT,
            question TEXT,
            created_at INTEGER,
            status TEXT
        )
        """
    )
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS escalation_messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            escalation_id INTEGER,
            content TEXT,
            created_at INTEGER,
            delivered_user INTEGER DEFAULT 0
        )
        """
    )
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS notifications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT,
            message TEXT,
            created_at INTEGER,
            delivered INTEGER
        )
        """
    )
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS datasets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            filename TEXT,
            path TEXT,
            uploaded_at INTEGER
        )
        """
    )
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS photo_requests (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT,
            query TEXT,
            photo_path TEXT,
            access_token TEXT,
            created_at INTEGER
        )
        """
    )
    conn.commit()
    conn.close()
    os.makedirs(UPLOAD_DIR, exist_ok=True)


def ensure_escalation_columns():
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute("PRAGMA table_info(escalations)")
    cols = {r[1] for r in cur.fetchall()}
    if "answer" not in cols:
        cur.execute("ALTER TABLE escalations ADD COLUMN answer TEXT")
    if "answered_at" not in cols:
        cur.execute("ALTER TABLE escalations ADD COLUMN answered_at INTEGER")
    if "delivered_user" not in cols:
        cur.execute(
            "ALTER TABLE escalations ADD COLUMN delivered_user INTEGER DEFAULT 0")
    conn.commit()
    conn.close()


def save_escalation(user_id: str, question: str) -> int:
    ts = int(time.time())
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute(
        "INSERT INTO escalations (user_id, question, created_at, status) VALUES (?, ?, ?, ?)",
        (user_id, question, ts, "pending"),
    )
    escalation_id = cur.lastrowid
    conn.commit()
    conn.close()
    return escalation_id


def notify_admin(user_id: str, question: str, escalation_id: Optional[int] = None) -> int:
    ts = int(time.time())
    msg = f"Пользователь {user_id} ожидает ответ. Вопрос: {question}"
    if escalation_id is not None:
        msg += f" (эскалация #{escalation_id})"
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute(
        "INSERT INTO notifications (user_id, message, created_at, delivered) VALUES (?, ?, ?, ?)",
        (user_id, msg, ts, 0),
    )
    notif_id = cur.lastrowid
    conn.commit()
    conn.close()
    return notif_id


def is_escalation(text: str) -> bool:
    t = (text or "").casefold()
    patterns = [
        "перевести на оператора",
        "переведи на оператора",
        "перевожу на оператора",
        "соединяю с оператором",
        "соединяю с оператор",
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
    api_url = DEFAULT_RAG_API_URL
    fallback_url = "http://127.0.0.1:8001/ask"
    if rag_module and hasattr(rag_module, "simple_request"):
        try:
            ans = rag_module.simple_request(api_url, question) or ""
            if ans:
                return ans, None
            ans2 = rag_module.simple_request(fallback_url, question) or ""
            return ans2, None
        except Exception:
            try:
                ans2 = rag_module.simple_request(fallback_url, question) or ""
                return ans2, None
            except Exception as e2:
                return "", str(e2)
    else:
        try:
            resp = requests.post(
                api_url, json={"question": question}, timeout=60)
            if resp.status_code == 200:
                try:
                    data = resp.json()
                    return data.get("answer", ""), None
                except Exception:
                    return resp.text or "", None
        except Exception:
            pass
        try:
            resp2 = requests.post(fallback_url, json={
                                  "question": question}, timeout=60)
            if resp2.status_code == 200:
                try:
                    data2 = resp2.json()
                    return data2.get("answer", ""), None
                except Exception:
                    return resp2.text or "", None
            return "", str(resp2.status_code)
        except Exception as e2:
            return "", str(e2)


app = Flask(__name__)
# Allow both localhost and 127.0.0.1 for Next.js dev server with credentials
CORS(
    app,
    supports_credentials=True,
    origins=[
        os.environ.get("FRONTEND_ORIGIN", "http://localhost:3000"),
        "http://127.0.0.1:3000",
    ],
)
Swagger(app)
app.secret_key = APP_SECRET
init_db()
ensure_escalation_columns()


def ensure_escalation_messages_columns():
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute("PRAGMA table_info(escalation_messages)")
    cols = {r[1] for r in cur.fetchall()}
    if "sender" not in cols:
        cur.execute(
            "ALTER TABLE escalation_messages ADD COLUMN sender TEXT DEFAULT 'admin'")
    if "delivered_admin" not in cols:
        cur.execute(
            "ALTER TABLE escalation_messages ADD COLUMN delivered_admin INTEGER DEFAULT 0")
    conn.commit()
    conn.close()


ensure_escalation_messages_columns()


def _migrate_old_chat_db():
    old_path = os.path.join(os.path.dirname(__file__), "chat_escalations.db")
    new_path = DB_PATH
    if not os.path.exists(old_path):
        return
    conn_new = sqlite3.connect(new_path)
    cur_new = conn_new.cursor()
    cur_new.execute(
        "CREATE TABLE IF NOT EXISTS escalations (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT, question TEXT, created_at INTEGER, status TEXT)")
    cur_new.execute(
        "CREATE TABLE IF NOT EXISTS notifications (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT, message TEXT, created_at INTEGER, delivered INTEGER)")
    cur_new.execute(
        "CREATE TABLE IF NOT EXISTS datasets (id INTEGER PRIMARY KEY AUTOINCREMENT, filename TEXT, path TEXT, uploaded_at INTEGER)")
    cur_new.execute("CREATE TABLE IF NOT EXISTS photo_requests (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT, query TEXT, photo_path TEXT, access_token TEXT, created_at INTEGER)")
    cur_new.execute("PRAGMA table_info(escalations)")
    cols = {r[1] for r in cur_new.fetchall()}
    if "answer" not in cols:
        cur_new.execute("ALTER TABLE escalations ADD COLUMN answer TEXT")
    if "answered_at" not in cols:
        cur_new.execute(
            "ALTER TABLE escalations ADD COLUMN answered_at INTEGER")
    if "delivered_user" not in cols:
        cur_new.execute(
            "ALTER TABLE escalations ADD COLUMN delivered_user INTEGER DEFAULT 0")
    conn_old = sqlite3.connect(old_path)
    cur_old = conn_old.cursor()

    def _has(name):
        cur_old.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name=?", (name,))
        return cur_old.fetchone() is not None
    if _has("escalations"):
        rows = []
        try:
            cur_old.execute(
                "SELECT id, user_id, question, created_at, status, answer, answered_at, delivered_user FROM escalations")
            rows = cur_old.fetchall()
        except Exception:
            cur_old.execute(
                "SELECT id, user_id, question, created_at, status FROM escalations")
            rows = [(r[0], r[1], r[2], r[3], r[4], None, None, 0)
                    for r in cur_old.fetchall()]
        cur_new.executemany(
            "INSERT OR IGNORE INTO escalations (id, user_id, question, created_at, status, answer, answered_at, delivered_user) VALUES (?,?,?,?,?,?,?,?)", rows)
    if _has("notifications"):
        cur_old.execute(
            "SELECT id, user_id, message, created_at, delivered FROM notifications")
        rows = cur_old.fetchall()
        cur_new.executemany(
            "INSERT OR IGNORE INTO notifications (id, user_id, message, created_at, delivered) VALUES (?,?,?,?,?)", rows)
    if _has("datasets"):
        cur_old.execute("SELECT id, filename, path, uploaded_at FROM datasets")
        rows = cur_old.fetchall()
        cur_new.executemany(
            "INSERT OR IGNORE INTO datasets (id, filename, path, uploaded_at) VALUES (?,?,?,?)", rows)
    if _has("photo_requests"):
        cur_old.execute(
            "SELECT id, user_id, query, photo_path, access_token, created_at FROM photo_requests")
        rows = cur_old.fetchall()
        cur_new.executemany(
            "INSERT OR IGNORE INTO photo_requests (id, user_id, query, photo_path, access_token, created_at) VALUES (?,?,?,?,?,?)", rows)
    conn_new.commit()
    conn_old.close()
    conn_new.close()


_migrate_old_chat_db()


@app.route("/api/admin/data", methods=["GET"])
def api_admin_data():
    """
    Get admin dashboard data
    ---
    tags:
      - Admin
    responses:
      200:
        description: Admin dashboard data including escalations, notifications, and datasets
        schema:
          type: object
          properties:
            escalations:
              type: array
              items:
                type: object
                properties:
                  id:
                    type: integer
                  user_id:
                    type: string
                  question:
                    type: string
                  created_at:
                    type: integer
            notifications:
              type: array
              items:
                type: object
                properties:
                  id:
                    type: integer
                  user_id:
                    type: string
                  message:
                    type: string
                  created_at:
                    type: integer
                  delivered:
                    type: integer
            datasets:
              type: array
              items:
                type: object
                properties:
                  id:
                    type: integer
                  filename:
                    type: string
                  path:
                    type: string
                  uploaded_at:
                    type: integer
    """
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute(
        "SELECT id, user_id, question, created_at FROM escalations WHERE status != 'answered' ORDER BY created_at DESC")
    escalations = [{"id": r[0], "user_id": r[1], "question": r[2],
                    "created_at": r[3]} for r in cur.fetchall()]
    cur.execute(
        "SELECT id, user_id, message, created_at, delivered FROM notifications ORDER BY created_at DESC")
    notifications = [{"id": r[0], "user_id": r[1], "message": r[2],
                      "created_at": r[3], "delivered": r[4]} for r in cur.fetchall()]
    cur.execute(
        "SELECT id, filename, path, uploaded_at FROM datasets ORDER BY uploaded_at DESC")
    datasets = [{"id": r[0], "filename": r[1], "path": r[2],
                 "uploaded_at": r[3]} for r in cur.fetchall()]
    conn.close()
    return jsonify({
        "escalations": escalations,
        "notifications": notifications,
        "datasets": datasets
    })


@app.route("/chat", methods=["GET"])
def chat_page():
    """
    Render the chat page
    ---
    tags:
      - Pages
    responses:
      200:
        description: HTML Chat page
    """
    if "user_id" not in session:
        session["user_id"] = f"user-{int(time.time())}"
    return render_template("chat.html")


@app.route("/chat/send", methods=["POST"])
def chat_send():
    """
    Send a message to the chat bot
    ---
    tags:
      - Chat
    parameters:
      - in: body
        name: body
        required: true
        schema:
          type: object
          properties:
            message:
              type: string
              description: The user's message
    responses:
      200:
        description: The bot's answer
        schema:
          type: object
          properties:
            ok:
              type: boolean
            answer:
              type: string
      400:
        description: Invalid input
      500:
        description: Internal server error
    """
    data = request.get_json(force=True) or {}
    question = str(data.get("message", "")).strip()
    user_id = session.get("user_id", "anonymous")
    if not question:
        return jsonify({"ok": False, "error": "Пустое сообщение"}), 400
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute(
        "SELECT id FROM escalations WHERE user_id = ? AND status != 'answered' ORDER BY created_at DESC LIMIT 1",
        (user_id,),
    )
    row = cur.fetchone()
    ts = int(time.time())
    if row:
        esc_id = int(row[0])
        cur.execute(
            "INSERT INTO escalation_messages (escalation_id, content, created_at, delivered_user, sender, delivered_admin) VALUES (?, ?, ?, ?, ?, ?)",
            (esc_id, question, ts, 0, "user", 0),
        )
        conn.commit()
        conn.close()
        return jsonify({"ok": True, "answer": "Сообщение отправлено оператору"})
    conn.close()
    answer, err = ask_rag(question)
    needs_escalation = bool(err) or is_escalation(question) or is_escalation(
        answer) or is_low_confidence_answer(answer)
    if needs_escalation:
        esc_id = save_escalation(user_id, question)
        notify_admin(user_id, question, esc_id)
        conn = sqlite3.connect(DB_PATH)
        cur = conn.cursor()
        cur.execute(
            "INSERT INTO escalation_messages (escalation_id, content, created_at, delivered_user, sender, delivered_admin) VALUES (?, ?, ?, ?, ?, ?)",
            (esc_id, question, ts, 0, "user", 0),
        )
        conn.commit()
        conn.close()
        return jsonify({"ok": True, "answer": "Перевожу на оператора. Ожидайте ответа."})
    return jsonify({"ok": True, "answer": answer})


@app.route("/api/ask_with_photo", methods=["POST"])
def api_ask_with_photo():
    """
    Ask a question with an attached photo
    ---
    tags:
      - Chat
    consumes:
      - multipart/form-data
    parameters:
      - in: formData
        name: file
        type: file
        required: true
        description: The image file to upload
      - in: formData
        name: query
        type: string
        required: false
        description: The question text
      - in: formData
        name: user_id
        type: string
        required: false
        description: User ID
      - in: formData
        name: access_token
        type: string
        required: false
        description: Access token
    responses:
      200:
        description: The answer from RAG
        schema:
          type: object
          properties:
            ok:
              type: boolean
            answer:
              type: string
      400:
        description: No file provided
      500:
        description: Internal server error
    """
    file = request.files.get("file")
    query = request.form.get("query", "")
    user_id = request.form.get("user_id", "anonymous")
    access_token = request.form.get("access_token", "")
    if not file:
        return jsonify({"ok": False, "error": "No file provided"}), 400
    ts = int(time.time())
    filename = f"photo_{ts}_{file.filename}"
    save_path = os.path.join(UPLOAD_DIR, filename)
    file.save(save_path)
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute(
        "INSERT INTO photo_requests (user_id, query, photo_path, access_token, created_at) VALUES (?, ?, ?, ?, ?)",
        (user_id, query, save_path, access_token, ts),
    )
    conn.commit()
    conn.close()
    answer, err = ask_rag(query)
    if err:
        return jsonify({"ok": False, "error": err}), 500
    return jsonify({"ok": True, "answer": answer})


@app.route("/chat/updates", methods=["GET"])
def chat_updates():
    """
    Poll for chat updates (admin answers)
    ---
    tags:
      - Chat
    responses:
      200:
        description: List of updates
        schema:
          type: object
          properties:
            ok:
              type: boolean
            updates:
              type: array
              items:
                type: object
                properties:
                  id:
                    type: integer
                  question:
                    type: string
                  answer:
                    type: string
                  answered_at:
                    type: integer
    """
    if "user_id" not in session:
        session["user_id"] = f"user-{int(time.time())}"
    user_id = session["user_id"]
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute(
        """
        SELECT m.id, e.question, m.content, m.created_at
        FROM escalation_messages m
        JOIN escalations e ON e.id = m.escalation_id
        WHERE e.user_id = ? AND m.delivered_user = 0
        ORDER BY m.created_at ASC
        """,
        (user_id,),
    )
    rows = cur.fetchall()
    updates = [{"id": r[0], "question": r[1],
                "answer": r[2], "answered_at": r[3]} for r in rows]
    if rows:
        ids = [r[0] for r in rows]
        cur.execute(
            f"UPDATE escalation_messages SET delivered_user = 1 WHERE id IN ({','.join('?' for _ in ids)})",
            ids,
        )
        conn.commit()
    # include undelivered notifications
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute(
        "SELECT id, message, created_at FROM notifications WHERE user_id = ? AND delivered = 0 ORDER BY created_at ASC",
        (user_id,),
    )
    nrows = cur.fetchall()
    if nrows:
        for nr in nrows:
            updates.append(
                {"id": nr[0], "question": "",
                    "answer": nr[1], "answered_at": nr[2]}
            )
        ids = [str(nr[0]) for nr in nrows]
        cur.execute(
            f"UPDATE notifications SET delivered = 1 WHERE id IN ({','.join('?' for _ in ids)})",
            ids,
        )
        conn.commit()
    conn.close()
    return jsonify({"ok": True, "updates": updates})


@app.route("/chat/history", methods=["GET"])
def chat_history():
    if "user_id" not in session:
        session["user_id"] = f"user-{int(time.time())}"
    user_id = session["user_id"]
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
        (user_id,),
    )
    rows = cur.fetchall()
    conn.close()
    messages = [
        {"id": r[0], "sender": r[1] or "admin", "content": r[2],
            "created_at": r[3], "escalation_id": r[4]}
        for r in rows
    ]
    return jsonify({"ok": True, "messages": messages})


@app.route("/admin", methods=["GET"])
def admin_page():
    """
    Render the admin dashboard
    ---
    tags:
      - Pages
    responses:
      200:
        description: HTML Admin dashboard
    """
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute(
        "SELECT id, user_id, question, created_at FROM escalations WHERE status != 'answered' ORDER BY created_at DESC")
    escalations = [{"id": r[0], "user_id": r[1], "question": r[2],
                    "created_at": r[3]} for r in cur.fetchall()]
    cur.execute(
        "SELECT id, user_id, message, created_at, delivered FROM notifications ORDER BY created_at DESC")
    notifications = [{"id": r[0], "user_id": r[1], "message": r[2],
                      "created_at": r[3], "delivered": r[4]} for r in cur.fetchall()]
    cur.execute(
        "SELECT id, filename, path, uploaded_at FROM datasets ORDER BY uploaded_at DESC")
    datasets = [{"id": r[0], "filename": r[1], "path": r[2],
                 "uploaded_at": r[3]} for r in cur.fetchall()]
    conn.close()
    return render_template("admin.html", escalations=escalations, notifications=notifications, datasets=datasets)


@app.route("/admin/updates", methods=["GET"])
def admin_updates():
    """
    Get updates for admin dashboard (new escalations)
    ---
    tags:
      - Admin
    responses:
      200:
        description: List of pending escalations
        schema:
          type: object
          properties:
            ok:
              type: boolean
            escalations:
              type: array
              items:
                type: object
                properties:
                  id:
                    type: integer
                  user_id:
                    type: string
                  question:
                    type: string
                  created_at:
                    type: integer
    """
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute(
        "SELECT id, user_id, question, created_at FROM escalations WHERE status != 'answered' ORDER BY created_at DESC")
    escalations = [{"id": r[0], "user_id": r[1], "question": r[2],
                    "created_at": r[3]} for r in cur.fetchall()]
    conn.close()
    return jsonify({"ok": True, "escalations": escalations})


@app.route("/admin/escalations/<int:esc_id>/answer", methods=["POST"])
def admin_escalation_answer(esc_id: int):
    """
    Answer an escalation
    ---
    tags:
      - Admin
    parameters:
      - in: path
        name: esc_id
        type: integer
        required: true
        description: ID of the escalation
      - in: body
        name: body
        required: false
        schema:
          type: object
          properties:
            answer:
              type: string
    responses:
      200:
        description: Answer submitted successfully
      400:
        description: Empty answer
    """
    if request.is_json:
        data = request.get_json()
        answer = str(data.get("answer", "")).strip()
    else:
        answer = str(request.form.get("answer", "")).strip()
    if not answer:
        if request.is_json:
            return jsonify({"ok": False, "error": "Empty answer"}), 400
        return redirect(url_for("admin_page"))
    ts = int(time.time())
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute(
        "INSERT INTO escalation_messages (escalation_id, content, created_at, delivered_user, sender, delivered_admin) VALUES (?, ?, ?, ?, ?, ?)",
        (esc_id, answer, ts, 0, "admin", 0),
    )
    conn.commit()
    conn.close()
    if request.is_json:
        return jsonify({"ok": True})
    return redirect(url_for("admin_page"))


@app.route("/admin/escalations/<int:esc_id>/close", methods=["POST"])
def admin_escalation_close(esc_id: int):
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute("SELECT user_id FROM escalations WHERE id = ?", (esc_id,))
    row = cur.fetchone()
    user_id = row[0] if row else None
    ts = int(time.time())
    if user_id:
        cur.execute(
            "INSERT INTO notifications (user_id, message, created_at, delivered) VALUES (?, ?, ?, ?)",
            (user_id, "Оператор закрыл обращение", ts, 0),
        )
    cur.execute(
        "DELETE FROM escalation_messages WHERE escalation_id = ?", (esc_id,))
    cur.execute("DELETE FROM escalations WHERE id = ?", (esc_id,))
    conn.commit()
    conn.close()
    return redirect(url_for("admin_page"))


@app.route("/admin/escalations/<int:esc_id>/messages", methods=["GET"])
def admin_escalation_messages(esc_id: int):
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute(
        "SELECT id, sender, content, created_at FROM escalation_messages WHERE escalation_id = ? ORDER BY created_at ASC, id ASC",
        (esc_id,),
    )
    rows = cur.fetchall()
    conn.close()
    messages = [{"id": r[0], "sender": r[1] or "admin",
                 "content": r[2], "created_at": r[3]} for r in rows]
    return jsonify({"ok": True, "messages": messages})


@app.route("/admin/escalations/<int:esc_id>/updates", methods=["GET"])
def admin_escalation_updates(esc_id: int):
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
    messages = [{"id": r[0], "sender": r[1] or "user",
                 "content": r[2], "created_at": r[3]} for r in rows]
    return jsonify({"ok": True, "messages": messages})


@app.route("/admin/upload", methods=["POST"])
def admin_upload():
    """
    Upload a dataset file
    ---
    tags:
      - Admin
    consumes:
      - multipart/form-data
    parameters:
      - in: formData
        name: file
        type: file
        required: true
        description: Excel file (.xlsx, .xls)
    responses:
      302:
        description: Redirects back to admin page
    """
    f = request.files.get("file")
    if not f or not f.filename:
        return redirect(url_for("admin_page"))
    name = f.filename
    ext = os.path.splitext(name)[1].lower()
    if ext not in [".xlsx", ".xls"]:
        return redirect(url_for("admin_page"))
    ts = int(time.time())
    safe_name = f"{ts}_{name}"
    save_path = os.path.join(UPLOAD_DIR, safe_name)
    f.save(save_path)
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute(
        "INSERT INTO datasets (filename, path, uploaded_at) VALUES (?, ?, ?)",
        (name, save_path, ts),
    )
    conn.commit()
    conn.close()
    return redirect(url_for("admin_page"))


@app.route("/admin/datasets/<int:ds_id>/download", methods=["GET"])
def admin_dataset_download(ds_id: int):
    """
    Download a dataset file
    ---
    tags:
      - Admin
    parameters:
      - in: path
        name: ds_id
        type: integer
        required: true
        description: ID of the dataset
    responses:
      200:
        description: File download
      302:
        description: Redirect if not found
    """
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute("SELECT filename, path FROM datasets WHERE id = ?", (ds_id,))
    row = cur.fetchone()
    conn.close()
    if not row:
        return redirect(url_for("admin_page"))
    filename, path = row
    d = os.path.dirname(path)
    return send_from_directory(d, os.path.basename(path), as_attachment=True, download_name=filename)


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8000, debug=True)
