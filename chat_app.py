import importlib.util
import os
import sqlite3
import time
from typing import Optional, Tuple

import requests
from flask import Flask, jsonify, redirect, render_template, request, send_from_directory, session, url_for


APP_SECRET = os.environ.get("CHAT_APP_SECRET", "dev-secret")
DEFAULT_RAG_API_URL = os.environ.get("RAG_API_URL", "URL")
RAG_MODULE_PATH = "/Users/evgen/Desktop/vondic/Rag-systems/rag.py"
DB_PATH = os.path.join(os.path.dirname(__file__), "chat_escalations.db")
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
        cur.execute("ALTER TABLE escalations ADD COLUMN delivered_user INTEGER DEFAULT 0")
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
        "перевожу на оператора",
        "соединяю с оператором",
        "соединяю с оператор",
        "оператору",
    ]
    return any(p in t for p in patterns)


def ask_rag(question: str) -> Tuple[str, Optional[str]]:
    api_url = DEFAULT_RAG_API_URL
    if rag_module and hasattr(rag_module, "simple_request"):
        try:
            answer = rag_module.simple_request(api_url, question)
            return answer, None
        except Exception as e:
            return "", str(e)
    else:
        try:
            resp = requests.post(api_url, json={"question": question}, timeout=60)
            if resp.status_code == 200:
                try:
                    data = resp.json()
                    return data.get("answer", ""), None
                except Exception:
                    return resp.text or "", None
            return "", str(resp.status_code)
        except Exception as e:
            return "", str(e)


app = Flask(__name__)
app.secret_key = APP_SECRET
init_db()
ensure_escalation_columns()


@app.route("/chat", methods=["GET"])
def chat_page():
    if "user_id" not in session:
        session["user_id"] = f"user-{int(time.time())}"
    return render_template("chat.html")


@app.route("/chat/send", methods=["POST"])
def chat_send():
    data = request.get_json(force=True) or {}
    question = str(data.get("message", "")).strip()
    user_id = session.get("user_id", "anonymous")
    if not question:
        return jsonify({"ok": False, "error": "Пустое сообщение"}), 400
    answer, err = ask_rag(question)
    if err:
        return jsonify({"ok": False, "error": err}), 500
    if is_escalation(answer):
        esc_id = save_escalation(user_id, question)
        notify_admin(user_id, question, esc_id)
    return jsonify({"ok": True, "answer": answer})


@app.route("/chat/updates", methods=["GET"])
def chat_updates():
    if "user_id" not in session:
        session["user_id"] = f"user-{int(time.time())}"
    user_id = session["user_id"]
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute(
        "SELECT id, question, answer, answered_at FROM escalations WHERE user_id = ? AND status = 'answered' AND delivered_user = 0 ORDER BY answered_at ASC",
        (user_id,),
    )
    rows = cur.fetchall()
    updates = [{"id": r[0], "question": r[1], "answer": r[2], "answered_at": r[3]} for r in rows]
    if rows:
        ids = [r[0] for r in rows]
        cur.execute(
            f"UPDATE escalations SET delivered_user = 1 WHERE id IN ({','.join('?' for _ in ids)})",
            ids,
        )
        conn.commit()
    conn.close()
    return jsonify({"ok": True, "updates": updates})


@app.route("/admin", methods=["GET"])
def admin_page():
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute("SELECT id, user_id, question, created_at FROM escalations WHERE status != 'answered' ORDER BY created_at DESC")
    escalations = [{"id": r[0], "user_id": r[1], "question": r[2], "created_at": r[3]} for r in cur.fetchall()]
    cur.execute("SELECT id, user_id, message, created_at, delivered FROM notifications ORDER BY created_at DESC")
    notifications = [{"id": r[0], "user_id": r[1], "message": r[2], "created_at": r[3], "delivered": r[4]} for r in cur.fetchall()]
    cur.execute("SELECT id, filename, path, uploaded_at FROM datasets ORDER BY uploaded_at DESC")
    datasets = [{"id": r[0], "filename": r[1], "path": r[2], "uploaded_at": r[3]} for r in cur.fetchall()]
    conn.close()
    return render_template("admin.html", escalations=escalations, notifications=notifications, datasets=datasets)


@app.route("/admin/updates", methods=["GET"])
def admin_updates():
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute("SELECT id, user_id, question, created_at FROM escalations WHERE status != 'answered' ORDER BY created_at DESC")
    escalations = [{"id": r[0], "user_id": r[1], "question": r[2], "created_at": r[3]} for r in cur.fetchall()]
    conn.close()
    return jsonify({"ok": True, "escalations": escalations})


@app.route("/admin/escalations/<int:esc_id>/answer", methods=["POST"])
def admin_escalation_answer(esc_id: int):
    answer = str(request.form.get("answer", "")).strip()
    if not answer:
        return redirect(url_for("admin_page"))
    ts = int(time.time())
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute(
        "UPDATE escalations SET answer = ?, answered_at = ?, status = ? WHERE id = ?",
        (answer, ts, "answered", esc_id),
    )
    conn.commit()
    conn.close()
    return redirect(url_for("admin_page"))


@app.route("/admin/upload", methods=["POST"])
def admin_upload():
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
