"""Storage routing — decide where to upload a file based on user rules."""

from __future__ import annotations

import logging

logger = logging.getLogger(__name__)

DEFAULT_RULES = {
    "enabled": False,
    "rules": [],
    "default_target": "s3",
}

EXTENSION_MAP = {
    "image": {"jpg", "jpeg", "png", "gif", "webp", "svg", "bmp", "ico"},
    "video": {"mp4", "mov", "webm", "mkv", "avi", "flv", "wmv"},
    "audio": {"mp3", "wav", "ogg", "flac", "m4a", "aac"},
    "document": {"pdf", "doc", "docx", "txt", "rtf", "odt", "xls", "xlsx", "ppt", "pptx"},
    "archive": {"zip", "rar", "7z", "tar", "gz"},
}


def _matches_rule(rule: dict, file_ext: str, file_size: int) -> bool:
    """Check if a file matches a single rule."""
    rule_type = rule.get("type")
    operator = rule.get("operator", "eq")
    value = rule.get("value")
    target = rule.get("target")

    if not rule_type or value is None or not target:
        return False

    if rule_type == "size":
        try:
            threshold = int(value)
        except (ValueError, TypeError):
            return False
        if operator == "gt":
            return file_size > threshold
        if operator == "gte":
            return file_size >= threshold
        if operator == "lt":
            return file_size < threshold
        if operator == "lte":
            return file_size <= threshold
        if operator == "eq":
            return file_size == threshold
        return False

    if rule_type == "extension":
        ext_lower = file_ext.lower()
        if operator == "in":
            if isinstance(value, str):
                value = [v.strip() for v in value.split(",")]
            return ext_lower in {v.lower() for v in value}
        if operator == "not_in":
            if isinstance(value, str):
                value = [v.strip() for v in value.split(",")]
            return ext_lower not in {v.lower() for v in value}
        if operator == "eq":
            return ext_lower == value.lower()
        return False

    if rule_type == "category":
        category_exts = EXTENSION_MAP.get(value.lower(), set())
        if operator == "in":
            return file_ext.lower() in category_exts
        if operator == "not_in":
            return file_ext.lower() not in category_exts
        return False

    return False


def resolve_storage_target(
    file_ext: str,
    file_size: int,
    user_rules: dict | None,
    yandex_disk_available: bool = False,
) -> str:
    """Determine storage target for a file.

    Returns "yandex_disk" or "s3".
    """
    rules = user_rules or DEFAULT_RULES

    if not rules.get("enabled") or not yandex_disk_available:
        return "s3"

    for rule in rules.get("rules", []):
        if _matches_rule(rule, file_ext, file_size):
            target = rule.get("target", "s3")
            if target == "yandex_disk" and yandex_disk_available:
                return "yandex_disk"
            return "s3"

    return rules.get("default_target", "s3")
