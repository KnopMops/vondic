"""IMAP/SMTP клиент для ящиков @vondic.ru (docker-mailserver)."""

from __future__ import annotations

import email
import imaplib
import re
import smtplib
import ssl
import time
from html import unescape
from email.header import decode_header
from email.header import Header
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.utils import formataddr, parseaddr
from typing import Any

from flask import current_app


def _tls_server_name() -> str:
    return (
        current_app.config.get("MAIL_TLS_SERVER_NAME")
        or current_app.config.get("MAIL_IMAP_HOST")
        or "mail.vondic.ru"
    )


def _ssl_context() -> ssl.SSLContext:
    ctx = ssl.create_default_context()
    if current_app.config.get("MAIL_IMAP_TLS_INSECURE"):
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
    return ctx


def _imap_settings() -> tuple[str, int, bool]:
    host = current_app.config.get("MAIL_IMAP_HOST") or _tls_server_name()
    port = int(current_app.config.get("MAIL_IMAP_PORT") or 993)
    use_ssl = current_app.config.get("MAIL_IMAP_USE_SSL", True)
    return host, port, use_ssl


def _smtp_settings() -> tuple[str, int, bool, bool]:
    host = (
        current_app.config.get("MAIL_SMTP_INTERNAL_HOST")
        or current_app.config.get("MAIL_SERVER")
        or _tls_server_name()
    )
    port = int(
        current_app.config.get("MAIL_SMTP_INTERNAL_PORT")
        or current_app.config.get("MAIL_PORT")
        or 587
    )
    use_tls = current_app.config.get("MAIL_USE_TLS", True)
    use_ssl = current_app.config.get("MAIL_USE_SSL", False)
    return host, port, use_tls, use_ssl


_LIST_LINE_RE = re.compile(
    r'LIST\s+\([^)]*\)\s+"[^"]*"\s+(?:"([^"]*)"|(\S+))\s*$',
    re.IGNORECASE,
)


_FOLDER_LABELS: dict[str, str] = {
    "INBOX": "Входящие",
    "INBOX.Sent": "Отправленные",
    "INBOX.Drafts": "Черновики",
    "INBOX.Trash": "Корзина",
    "INBOX.Junk": "Спам",
    "INBOX.Spam": "Спам",
    "Sent": "Отправленные",
    "Sent Messages": "Отправленные",
    "Drafts": "Черновики",
    "Trash": "Корзина",
    "Junk": "Спам",
    "Spam": "Спам",
    ".Sent": "Отправленные",
    ".Trash": "Корзина",
    ".Drafts": "Черновики",
    ".Junk": "Спам",
}

_SENT_FOLDER_CANDIDATES = (
    "Sent",
    "INBOX.Sent",
    "Sent Messages",
    ".Sent",
)
_TRASH_FOLDER_CANDIDATES = (
    "Trash",
    "INBOX.Trash",
    ".Trash",
)


def _decode_mailbox_name(name: str) -> str:
    if not name:
        return name
    try:
        if hasattr(imaplib, "IMAP4_utf7"):
            return imaplib.IMAP4_utf7.decode(name.encode("ascii"))
    except Exception:
        pass
    return name


def _encode_mailbox_name(name: str) -> str:
    if all(ord(c) < 128 for c in name):
        return name
    try:
        if hasattr(imaplib, "IMAP4_utf7"):
            return imaplib.IMAP4_utf7.encode(
                name.encode("utf-8")).decode("ascii")
    except Exception:
        pass
    return name


def _mailbox_select_arg(name: str) -> str:
    encoded = _encode_mailbox_name(name)
    if any(c in encoded for c in (' ', '.', '&', '%')):
        return f'"{encoded}"'
    return encoded


def _select_mailbox(imap: imaplib.IMAP4, folder: str) -> None:
    name = "INBOX" if folder.upper() == "INBOX" else folder
    if name in (".", "..", ""):
        raise ValueError(f"Invalid mailbox: {folder!r}")
    mailbox = _mailbox_select_arg(name)
    typ, _ = imap.select(mailbox)
    if typ != "OK":
        raise ValueError(f"Cannot select mailbox {folder!r}")


def _list_mailbox_names(imap: imaplib.IMAP4) -> set[str]:
    status, data = imap.list()
    names: set[str] = {"INBOX"}
    if status != "OK" or not data:
        return names
    for raw in data:
        if not isinstance(raw, bytes):
            continue
        line = raw.decode("utf-8", errors="replace")
        parsed = _parse_list_line(line)
        if parsed:
            names.add(parsed)
    return names


def _resolve_folder(imap: imaplib.IMAP4, candidates: tuple[str, ...]) -> str:
    available = _list_mailbox_names(imap)
    by_upper = {n.upper(): n for n in available}
    for candidate in candidates:
        if candidate in available:
            return candidate
        hit = by_upper.get(candidate.upper())
        if hit:
            return hit
    return candidates[0]


def _parse_list_line(line: str) -> str | None:
    line = line.strip()
    m = _LIST_LINE_RE.search(line)
    if m:
        raw = m.group(1) if m.group(1) is not None else m.group(2)
        if raw and raw != ".":
            return _decode_mailbox_name(raw)

    m2 = re.search(r'"\s*\.\s*"\s+(\S+)\s*$', line)
    if m2:
        raw = m2.group(1).strip('"')
        if raw and raw != ".":
            return _decode_mailbox_name(raw)
    m3 = re.search(r'"([^"]+)"\s*$', line)
    if m3:
        raw = m3.group(1)
        if raw and raw != ".":
            return _decode_mailbox_name(raw)
    return None


def _decode_payload(payload: bytes, charset: str | None) -> str:
    enc = charset or "utf-8"
    try:
        return payload.decode(enc, errors="replace")
    except LookupError:
        return payload.decode("utf-8", errors="replace")


def _decode_mime_header(value: str | None) -> str:
    if not value:
        return ""
    parts = decode_header(value)
    out: list[str] = []
    for chunk, enc in parts:
        if isinstance(chunk, bytes):
            out.append(chunk.decode(enc or "utf-8", errors="replace"))
        else:
            out.append(str(chunk))
    return "".join(out)


class MailImapService:
    def __init__(self, address: str, password: str):
        self.address = address
        self.password = password

    def _connect_imap(self) -> imaplib.IMAP4:
        host, port, use_ssl = _imap_settings()
        tls_name = _tls_server_name()

        connect_host = tls_name if host in (
            "mailserver", "localhost") else host
        if use_ssl:
            client: imaplib.IMAP4 = imaplib.IMAP4_SSL(
                connect_host, port, ssl_context=_ssl_context()
            )
        else:
            client = imaplib.IMAP4(connect_host, port)
        client.login(self.address, self.password)
        return client

    def list_folders(self) -> list[dict[str, str]]:
        with self._imap_session() as imap:
            status, data = imap.list()
            if status != "OK" or not data:
                return [{"id": "INBOX", "name": "Входящие"}]
            seen: set[str] = set()
            folders: list[dict[str, str]] = []
            for raw in data:
                if not isinstance(raw, bytes):
                    continue
                line = raw.decode("utf-8", errors="replace")
                name = _parse_list_line(line)
                if not name or name in seen:
                    continue
                seen.add(name)
                label = _FOLDER_LABELS.get(
                    name) or _FOLDER_LABELS.get(name.upper()) or name
                folders.append({"id": name, "name": label})
            if not any(f["id"].upper() == "INBOX" for f in folders):
                folders.insert(0, {"id": "INBOX", "name": "Входящие"})
            return folders

    def list_messages(
        self, folder: str = "INBOX", limit: int = 50, offset: int = 0
    ) -> list[dict[str, Any]]:
        limit = min(max(limit, 1), 100)
        offset = max(offset, 0)
        with self._imap_session() as imap:
            _select_mailbox(imap, folder)
            uids = _uid_search_all(imap)
            uids = uids[::-1][offset: offset + limit]
            result: list[dict[str, Any]] = []
            for uid in uids:
                uid_str = uid.decode() if isinstance(uid, bytes) else str(uid)
                st, msg_data = imap.uid(
                    "FETCH",
                    uid,
                    "(FLAGS BODY.PEEK[HEADER.FIELDS (FROM SUBJECT DATE)])",
                )
                if st != "OK" or not msg_data:
                    continue
                header_bytes = b""
                for part in msg_data:
                    if isinstance(part, tuple) and len(part) >= 2:
                        if isinstance(part[1], bytes):
                            header_bytes = part[1]
                if not header_bytes:
                    continue
                msg = email.message_from_bytes(header_bytes)
                from_addr = _decode_mime_header(msg.get("From"))
                subject = _decode_mime_header(
                    msg.get("Subject")) or "(без темы)"
                date_hdr = msg.get("Date") or ""
                _, from_email = parseaddr(from_addr)
                result.append(
                    {
                        "uid": uid_str,
                        "from": from_addr,
                        "from_email": from_email,
                        "subject": subject,
                        "date": date_hdr,
                        "seen": _seen_from_fetch_data(msg_data),
                        "folder": folder,
                    }
                )
            return result

    def get_message(self, folder: str, uid: str) -> dict[str, Any]:
        with self._imap_session() as imap:
            _select_mailbox(imap, folder)
            uid_arg = uid.encode() if isinstance(uid, str) else uid
            st, msg_data = imap.uid(
                "FETCH", uid_arg, "(FLAGS BODY.PEEK[])"
            )
            if st != "OK" or not msg_data:
                raise ValueError("Message not found")
            raw = b""
            for part in msg_data:
                if isinstance(part, tuple) and len(part) >= 2:
                    if isinstance(part[1], bytes) and len(part[1]) > len(raw):
                        raw = part[1]
            if not raw:
                raise ValueError("Message not found")
            msg = email.message_from_bytes(raw)
            body_text, body_html = _extract_bodies(msg)
            from_addr = _decode_mime_header(msg.get("From"))
            _, from_email = parseaddr(from_addr)
            return {
                "uid": str(uid),
                "folder": folder,
                "from": from_addr,
                "from_email": from_email,
                "to": _decode_mime_header(
                    msg.get("To")),
                "subject": _decode_mime_header(
                    msg.get("Subject")) or "(без темы)",
                "date": msg.get("Date") or "",
                "body_text": body_text,
                "body_html": body_html,
                "seen": _seen_from_fetch_data(msg_data),
            }

    def mark_seen(self, folder: str, uid: str) -> bool:
        with self._imap_session() as imap:
            _select_mailbox(imap, folder)
            uid_arg = uid.encode() if isinstance(uid, str) else uid
            typ, _ = imap.uid("STORE", uid_arg, "+FLAGS", r"(\Seen)")
            return typ == "OK"

    def move_to_trash(self, folder: str, uid: str) -> bool:
        with self._imap_session() as imap:
            trash = _resolve_folder(imap, _TRASH_FOLDER_CANDIDATES)
            _select_mailbox(imap, folder)
            uid_arg = uid.encode() if isinstance(uid, str) else uid
            trash_arg = _mailbox_select_arg(trash)
            typ, _ = imap.uid("COPY", uid_arg, trash_arg)
            if typ != "OK":
                return False
            typ, _ = imap.uid("STORE", uid_arg, "+FLAGS", r"(\Deleted)")
            if typ != "OK":
                return False
            imap.expunge()
            return True

    def build_message(
        self,
        to_addrs: list[str],
        subject: str,
        body_text: str,
        body_html: str | None = None,
        cc: list[str] | None = None,
        from_address: str | None = None,
        from_name: str | None = None,
    ) -> MIMEMultipart:
        sender = from_address or self.address
        display = from_name or sender.split("@")[0]
        msg = MIMEMultipart("alternative")
        msg["Subject"] = Header(subject, "utf-8")
        msg["From"] = formataddr((display, sender))
        msg["To"] = ", ".join(to_addrs)
        if cc:
            msg["Cc"] = ", ".join(cc)
        msg.attach(MIMEText(body_text, "plain", "utf-8"))
        if body_html:
            msg.attach(MIMEText(body_html, "html", "utf-8"))
        return msg

    def _smtp_send(self, msg: MIMEMultipart, recipients: list[str]) -> None:
        host, port, use_tls, use_ssl = _smtp_settings()
        tls_name = _tls_server_name()
        connect_host = tls_name if host in (
            "mailserver", "localhost") else host
        ctx = _ssl_context()
        from_addr = parseaddr(msg["From"])[1] or self.address
        if use_ssl:
            server: smtplib.SMTP = smtplib.SMTP_SSL(
                connect_host, port, context=ctx
            )
        else:
            server = smtplib.SMTP(connect_host, port)
        try:
            if use_tls and not use_ssl:
                server.starttls(context=ctx)
            server.login(self.address, self.password)
            try:
                server.send_message(msg)
            except Exception:
                server.sendmail(from_addr, recipients, msg.as_string())
        finally:
            server.quit()

    def _append_to_sent(self, raw_message: bytes) -> None:
        with self._imap_session() as imap:
            sent = _resolve_folder(imap, _SENT_FOLDER_CANDIDATES)
            mailbox = _mailbox_select_arg(sent)
            date = imaplib.Time2Internaldate(time.time())
            typ, _ = imap.append(
                mailbox,
                r"(\Seen)",
                date,
                raw_message,
            )
            if typ != "OK":
                raise RuntimeError(f"Cannot save copy to {sent}")

    def send_message(
        self,
        to_addrs: list[str],
        subject: str,
        body_text: str,
        body_html: str | None = None,
        cc: list[str] | None = None,
    ) -> None:
        msg = self.build_message(
            to_addrs=to_addrs,
            subject=subject,
            body_text=body_text,
            body_html=body_html,
            cc=cc,
        )
        recipients = list(to_addrs) + list(cc or [])
        raw = msg.as_bytes()
        self._smtp_send(msg, recipients)
        try:
            self._append_to_sent(raw)
        except Exception:
            current_app.logger.warning(
                "Sent folder append failed for %s", self.address, exc_info=True
            )

    def _imap_session(self):
        return _ImapContext(self)


class _ImapContext:
    def __init__(self, service: MailImapService):
        self._service = service
        self._imap: imaplib.IMAP4 | None = None

    def __enter__(self) -> imaplib.IMAP4:
        self._imap = self._service._connect_imap()
        return self._imap

    def __exit__(self, *args: object) -> None:
        if self._imap:
            try:
                self._imap.logout()
            except Exception:
                pass


def _parse_flags(raw: bytes) -> list[str]:
    text = raw.decode("utf-8", errors="replace")
    if "FLAGS" not in text:
        return []
    start = text.find("(")
    end = text.rfind(")")
    if start < 0 or end < 0:
        return []
    inner = text[start + 1: end]
    return [f.strip() for f in inner.split() if f.strip().startswith("\\")]


def _flags_include_seen(flags: list[str]) -> bool:
    return any(f.upper() == r"\SEEN" for f in flags)


def _seen_from_fetch_data(msg_data: list) -> bool:
    for part in msg_data:
        if not isinstance(part, tuple) or not part[0]:
            continue
        raw = part[0]
        if not isinstance(raw, bytes):
            continue
        if b"\\Seen" in raw or b"\\SEEN" in raw:
            return True
        if _flags_include_seen(_parse_flags(raw)):
            return True
    return False


def _uid_search_all(imap: imaplib.IMAP4) -> list[bytes]:
    status, data = imap.uid("SEARCH", None, "ALL")
    if status != "OK" or not data or not data[0]:
        return []
    return data[0].split()


def _html_to_text(html: str) -> str:
    text = re.sub(r"(?is)<(script|style)[^>]*>.*?</\1>", " ", html)
    text = re.sub(r"(?i)<br\s*/?>", "\n", text)
    text = re.sub(r"(?i)</p>", "\n\n", text)
    text = re.sub(r"<[^>]+>", " ", text)
    text = unescape(text)
    return re.sub(r"\n{3,}", "\n\n", text).strip()


def _extract_bodies(msg: email.message.Message) -> tuple[str, str | None]:
    text_parts: list[str] = []
    html_parts: list[str] = []
    if msg.is_multipart():
        for part in msg.walk():
            ctype = part.get_content_type()
            disp = str(part.get("Content-Disposition", ""))
            if "attachment" in disp:
                continue
            payload = part.get_payload(decode=True)
            if not payload:
                continue
            charset = part.get_content_charset()
            decoded = _decode_payload(payload, charset)
            if ctype == "text/plain":
                text_parts.append(decoded)
            elif ctype == "text/html":
                html_parts.append(decoded)
    else:
        payload = msg.get_payload(decode=True)
        if payload:
            charset = msg.get_content_charset()
            decoded = _decode_payload(payload, charset)
            if msg.get_content_type() == "text/html":
                html_parts.append(decoded)
            else:
                text_parts.append(decoded)
    text = "\n\n".join(text_parts).strip()
    html = "\n\n".join(html_parts).strip() or None
    if not text and html:
        text = _html_to_text(html)
    return (text, html)
