"""IMAP/SMTP клиент для ящиков @vondic.ru (docker-mailserver)."""

from __future__ import annotations

import email
import imaplib
import logging
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

from app.core.config import settings

logger = logging.getLogger(__name__)


def _tls_server_name() -> str:
    return (
        getattr(settings, "MAIL_TLS_SERVER_NAME", None)
        or getattr(settings, "MAIL_IMAP_HOST", None)
        or "vondic.ru"
    )


def _create_ssl_context() -> ssl.SSLContext:
    ctx = ssl.create_default_context()
    if getattr(settings, "MAIL_IMAP_TLS_INSECURE", False):
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
    return ctx


def _get_imap_config() -> tuple[str, int, bool]:
    host = getattr(settings, "MAIL_IMAP_HOST", None) or _tls_server_name()
    port = int(getattr(settings, "MAIL_IMAP_PORT", 993) or 993)
    use_ssl = getattr(settings, "MAIL_IMAP_USE_SSL", True)
    return host, port, use_ssl


def _get_smtp_config() -> tuple[str, int, bool, bool]:
    host = (
        getattr(settings, "MAIL_SMTP_INTERNAL_HOST", None)
        or getattr(settings, "MAIL_SERVER", None)
        or "mailserver"
    )
    port = int(
        getattr(settings, "MAIL_SMTP_INTERNAL_PORT", None)
        or getattr(settings, "MAIL_PORT", None)
        or 587
    )
    use_tls = getattr(settings, "MAIL_USE_TLS", True)
    use_ssl = getattr(settings, "MAIL_USE_SSL", False)
    return host, port, use_tls, use_ssl


def _decode_str(raw: str | bytes | None, default_charset: str = "utf-8") -> str:
    if raw is None:
        return ""
    if isinstance(raw, bytes):
        try:
            return raw.decode(default_charset)
        except UnicodeDecodeError:
            return raw.decode("latin1", errors="replace")
    return str(raw)


def _decode_header_str(value: str | bytes | None) -> str:
    if not value:
        return ""
    try:
        parts = decode_header(value)
        out = []
        for text, encoding in parts:
            if isinstance(text, bytes):
                enc = encoding or "utf-8"
                try:
                    out.append(text.decode(enc))
                except (UnicodeDecodeError, LookupError):
                    out.append(text.decode("latin1", errors="replace"))
            else:
                out.append(str(text))
        return "".join(out)
    except Exception:
        return str(value)


def _clean_body_text(text: str) -> str:
    if not text:
        return ""
    text = re.sub(r"<!DOCTYPE[^>]*>", "", text, flags=re.I)
    text = re.sub(r"<head[^>]*>.*?</head>", "", text, flags=re.I | re.S)
    text = re.sub(r"<style[^>]*>.*?</style>", "", text, flags=re.I | re.S)
    text = re.sub(r"<script[^>]*>.*?</script>", "", text, flags=re.I | re.S)
    text = re.sub(r"<br\s*/?>", "\n", text, flags=re.I)
    text = re.sub(r"</p>", "\n\n", text, flags=re.I)
    text = re.sub(r"<[^>]+>", "", text)
    text = unescape(text)
    lines = [line.rstrip() for line in text.splitlines()]
    res = []
    blank = False
    for line in lines:
        if not line:
            if not blank:
                res.append("")
                blank = True
        else:
            res.append(line)
            blank = False
    return "\n".join(res).strip()


class MailImapService:
    @staticmethod
    def _connect_imap(
        address: str, password: str, timeout: int = 15
    ) -> imaplib.IMAP4:
        host, port, use_ssl = _get_imap_config()
        ctx = _create_ssl_context()
        srv_name = _tls_server_name()

        if use_ssl:
            client = imaplib.IMAP4_SSL(
                host, port=port, ssl_context=ctx, timeout=timeout
            )
        else:
            client = imaplib.IMAP4(host, port=port, timeout=timeout)
            if "STARTTLS" in client.capabilities:
                client.starttls(ssl_context=ctx)

        client.login(address, password)
        return client

    @staticmethod
    def test_credentials(address: str, password: str) -> tuple[bool, str]:
        try:
            cli = MailImapService._connect_imap(address, password, timeout=10)
            cli.logout()
            return True, "OK"
        except imaplib.IMAP4.error as e:
            return False, f"Ошибка авторизации IMAP: {e}"
        except Exception as e:
            return False, f"Ошибка подключения к почтовому серверу: {e}"

    @staticmethod
    def list_folders(address: str, password: str) -> list[dict[str, Any]]:
        client = MailImapService._connect_imap(address, password)
        try:
            status, data = client.list()
            if status != "OK" or not data:
                return []
            folders = []
            for item in data:
                if not item:
                    continue
                line = _decode_str(item)
                m = re.search(r'\(([^)]*)\)\s+"([^"]+)"\s+"?([^"]+)"?$', line)
                if not m:
                    m = re.search(r'\(([^)]*)\)\s+"([^"]+)"\s+(.+)$', line)
                if m:
                    flags_raw, delim, name = m.group(1), m.group(2), m.group(3)
                    name = name.strip('"')
                    folders.append({
                        "name": name,
                        "delimiter": delim,
                        "flags": flags_raw.split(),
                    })
            return folders
        finally:
            try:
                client.logout()
            except Exception:
                pass

    @staticmethod
    def fetch_messages(
        address: str,
        password: str,
        folder: str = "INBOX",
        limit: int = 50,
        offset: int = 0,
        unread_only: bool = False,
    ) -> tuple[list[dict[str, Any]], int]:
        client = MailImapService._connect_imap(address, password)
        try:
            status, select_data = client.select(f'"{folder}"', readonly=True)
            if status != "OK":
                return [], 0
            total_in_folder = int(select_data[0] or 0) if select_data else 0

            crit = "UNSEEN" if unread_only else "ALL"
            status, search_data = client.search(None, crit)
            if status != "OK" or not search_data or not search_data[0]:
                return [], total_in_folder

            uids = search_data[0].split()
            uids.reverse()

            total_matching = len(uids)
            page_uids = uids[offset: offset + limit]
            if not page_uids:
                return [], total_in_folder

            uid_set = b",".join(page_uids)
            status, fetch_data = client.fetch(
                uid_set, "(FLAGS INTERNALDATE RFC822.HEADER)"
            )
            if status != "OK" or not fetch_data:
                return [], total_in_folder

            items_by_num: dict[bytes, dict] = {}
            current_num: bytes | None = None

            for row in fetch_data:
                if isinstance(row, tuple):
                    meta = _decode_str(row[0])
                    m = re.match(r"^(\d+)\s+\(", meta)
                    if m:
                        current_num = m.group(1).encode("ascii")
                        items_by_num[current_num] = {
                            "meta": meta,
                            "header": row[1],
                        }
                elif isinstance(row, bytes):
                    pass

            result = []
            for num in page_uids:
                data_dict = items_by_num.get(num)
                if not data_dict:
                    continue
                meta_str = data_dict["meta"]
                hdr_bytes = data_dict["header"]

                flags_match = re.search(r"FLAGS\s+\(([^)]*)\)", meta_str)
                flags_str = flags_match.group(1) if flags_match else ""
                is_read = r"\Seen" in flags_str

                msg = email.message_from_bytes(hdr_bytes)

                subject = _decode_header_str(msg.get("Subject"))
                from_hdr = _decode_header_str(msg.get("From"))
                to_hdr = _decode_header_str(msg.get("To"))
                date_hdr = msg.get("Date") or ""

                sender_name, sender_addr = parseaddr(from_hdr)

                result.append({
                    "id": num.decode("ascii"),
                    "subject": subject or "(Без темы)",
                    "from_name": sender_name or sender_addr,
                    "from_address": sender_addr,
                    "from": from_hdr,
                    "to": to_hdr,
                    "date": date_hdr,
                    "is_read": is_read,
                    "folder": folder,
                })

            return result, total_matching
        finally:
            try:
                client.logout()
            except Exception:
                pass

    @staticmethod
    def get_message_detail(
        address: str,
        password: str,
        msg_id: str,
        folder: str = "INBOX",
        mark_read: bool = True,
    ) -> dict[str, Any] | None:
        client = MailImapService._connect_imap(address, password)
        try:
            readonly = not mark_read
            status, _ = client.select(f'"{folder}"', readonly=readonly)
            if status != "OK":
                return None

            status, fetch_data = client.fetch(msg_id, "(FLAGS RFC822)")
            if status != "OK" or not fetch_data or not fetch_data[0]:
                return None

            raw_body: bytes | None = None
            meta_str = ""
            for item in fetch_data:
                if isinstance(item, tuple):
                    meta_str = _decode_str(item[0])
                    raw_body = item[1]

            if not raw_body:
                return None

            flags_match = re.search(r"FLAGS\s+\(([^)]*)\)", meta_str)
            flags_str = flags_match.group(1) if flags_match else ""
            is_read = r"\Seen" in flags_str

            msg = email.message_from_bytes(raw_body)

            subject = _decode_header_str(msg.get("Subject"))
            from_hdr = _decode_header_str(msg.get("From"))
            to_hdr = _decode_header_str(msg.get("To"))
            date_hdr = msg.get("Date") or ""

            sender_name, sender_addr = parseaddr(from_hdr)

            text_plain = ""
            text_html = ""
            attachments = []

            if msg.is_multipart():
                for part in msg.walk():
                    content_type = part.get_content_type()
                    disp = str(part.get("Content-Disposition") or "")
                    if "attachment" in disp:
                        fn = _decode_header_str(part.get_filename())
                        attachments.append({
                            "filename": fn or "unnamed",
                            "content_type": content_type,
                            "size": len(part.get_payload(decode=True) or b""),
                        })
                    elif content_type == "text/plain" and not text_plain:
                        payload = part.get_payload(decode=True)
                        charset = part.get_content_charset() or "utf-8"
                        text_plain = _decode_str(payload, charset)
                    elif content_type == "text/html" and not text_html:
                        payload = part.get_payload(decode=True)
                        charset = part.get_content_charset() or "utf-8"
                        text_html = _decode_str(payload, charset)
            else:
                payload = msg.get_payload(decode=True)
                charset = msg.get_content_charset() or "utf-8"
                ct = msg.get_content_type()
                if ct == "text/html":
                    text_html = _decode_str(payload, charset)
                else:
                    text_plain = _decode_str(payload, charset)

            body_preview = text_plain or _clean_body_text(text_html)

            return {
                "id": msg_id,
                "folder": folder,
                "subject": subject or "(Без темы)",
                "from_name": sender_name or sender_addr,
                "from_address": sender_addr,
                "from": from_hdr,
                "to": to_hdr,
                "date": date_hdr,
                "is_read": is_read or mark_read,
                "text_plain": text_plain,
                "text_html": text_html,
                "body": body_preview,
                "attachments": attachments,
            }
        finally:
            try:
                client.logout()
            except Exception:
                pass

    @staticmethod
    def send_message(
        address: str,
        password: str,
        to_address: str,
        subject: str,
        body: str,
        is_html: bool = False,
        display_name: str | None = None,
    ) -> tuple[bool, str]:
        host, port, use_tls, use_ssl = _get_smtp_config()
        ctx = _create_ssl_context()

        msg = MIMEMultipart("alternative")
        msg["Subject"] = Header(subject, "utf-8")
        from_str = formataddr((display_name or address, address))
        msg["From"] = from_str
        msg["To"] = to_address

        if is_html:
            msg.attach(MIMEText(body, "html", "utf-8"))
            plain = _clean_body_text(body)
            if plain:
                msg.attach(MIMEText(plain, "plain", "utf-8"))
        else:
            msg.attach(MIMEText(body, "plain", "utf-8"))

        try:
            if use_ssl:
                server = smtplib.SMTP_SSL(
                    host, port=port, ssl_context=ctx, timeout=15
                )
            else:
                server = smtplib.SMTP(host, port=port, timeout=15)
                if use_tls:
                    server.starttls(ssl_context=ctx)

            server.login(address, password)
            server.sendmail(address, [to_address], msg.as_string())
            server.quit()
            return True, "Отправлено"
        except smtplib.SMTPException as e:
            return False, f"Ошибка SMTP: {e}"
        except Exception as e:
            return False, f"Ошибка отправки: {e}"

    @staticmethod
    def delete_message(
        address: str, password: str, msg_id: str, folder: str = "INBOX"
    ) -> bool:
        client = MailImapService._connect_imap(address, password)
        try:
            status, _ = client.select(f'"{folder}"')
            if status != "OK":
                return False

            client.store(msg_id, "+FLAGS", r"(\Deleted)")
            client.expunge()
            return True
        except Exception as e:
            logger.warning(f"Error deleting IMAP message {msg_id}: {e}")
            return False
        finally:
            try:
                client.logout()
            except Exception:
                pass
