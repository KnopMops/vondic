"""Статический анализ HTML/CSS/JS игр для ботов."""

from __future__ import annotations

import os
import re
from pathlib import Path

ALLOWED_EXTENSIONS = {
    ".html",
    ".htm",
    ".css",
    ".js",
    ".json",
    ".png",
    ".jpg",
    ".jpeg",
    ".gif",
    ".webp",
    ".svg",
    ".ico",
    ".woff",
    ".woff2",
    ".ttf",
    ".mp3",
    ".wav",
    ".ogg",
    ".mp4",
    ".webm",
}

FORBIDDEN_EXTENSIONS = {
    ".php",
    ".py",
    ".sh",
    ".bat",
    ".exe",
    ".dll",
    ".so",
    ".jar",
    ".wasm",
    ".asp",
    ".aspx",
    ".jsp",
    ".cgi",
    ".pl",
    ".rb",
    ".go",
    ".rs",
    ".sql",
    ".env",
    ".zip",
    ".rar",
    ".7z",
}

DANGEROUS_PATTERNS = [
    re.compile(r"\beval\s*\(", re.I),
    re.compile(r"new\s+Function\s*\(", re.I),
    re.compile(r"document\.write\s*\(", re.I),
    re.compile(r"\.innerHTML\s*=", re.I),
    re.compile(r"javascript\s*:", re.I),
    re.compile(r"<\s*script[^>]+src\s*=\s*['\"]https?://", re.I),
    re.compile(r"\bfetch\s*\(\s*['\"]https?://", re.I),
    re.compile(r"\bXMLHttpRequest\b", re.I),
    re.compile(r"\bWebSocket\s*\(", re.I),
    re.compile(r"\bimportScripts\s*\(", re.I),
]

MAX_FILES = 200
MAX_TOTAL_BYTES = 25 * 1024 * 1024
MAX_FILE_BYTES = 5 * 1024 * 1024
SCANNABLE_TEXT = {".html", ".htm", ".css", ".js", ".json"}


def scan_game_directory(root: str) -> tuple[bool, str | None, dict]:
    base = Path(root).resolve()
    if not base.is_dir():
        return False, "Папка игры не найдена", {}

    index_candidates = [
        base / "index.html",
        base / "Index.html",
        base / "game.html",
    ]
    entry = next((p for p in index_candidates if p.is_file()), None)
    if not entry:
        return False, "Требуется index.html в корне архива", {}

    file_count = 0
    total_bytes = 0
    issues: list[str] = []

    for path in base.rglob("*"):
        if not path.is_file():
            continue
        rel = path.relative_to(base)
        if ".." in rel.parts:
            return False, "Недопустимый путь в архиве", {}

        file_count += 1
        if file_count > MAX_FILES:
            return False, f"Слишком много файлов (макс. {MAX_FILES})", {}

        ext = path.suffix.lower()
        if ext in FORBIDDEN_EXTENSIONS:
            return False, f"Запрещённый тип файла: {rel}", {}
        if ext and ext not in ALLOWED_EXTENSIONS:
            return False, f"Неподдерживаемый файл: {rel}", {}

        size = path.stat().st_size
        total_bytes += size
        if size > MAX_FILE_BYTES:
            return False, f"Файл слишком большой: {rel}", {}
        if total_bytes > MAX_TOTAL_BYTES:
            return False, "Общий размер игры превышает лимит", {}

        if ext in SCANNABLE_TEXT:
            try:
                text = path.read_text(encoding="utf-8", errors="replace")
            except OSError:
                issues.append(f"Не удалось прочитать: {rel}")
                continue
            for pattern in DANGEROUS_PATTERNS:
                if pattern.search(text):
                    return (
                        False,
                        f"Подозрительный код в {rel}: {pattern.pattern}",
                        {},
                    )

    meta = {
        "file_count": file_count,
        "total_bytes": total_bytes,
        "entry": str(entry.relative_to(base)).replace("\\", "/"),
    }
    if issues:
        return False, "; ".join(issues[:5]), meta
    return True, None, meta
