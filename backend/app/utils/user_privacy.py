"""Скрытие персональных полей пользователя с учётом privacy_settings."""


def _viewer_may_see_email(data: dict, viewer_id: str | None) -> bool:
    if viewer_id is None:
        return False
    uid = data.get("id")
    if uid is not None and str(uid) == str(viewer_id):
        return True
    settings = data.get("privacy_settings") or {}
    return bool(settings.get("show_email"))


def redact_user_dict(data: dict, viewer_id: str | None = None) -> dict:
    out = dict(data)
    if not _viewer_may_see_email(out, viewer_id):
        out["email"] = None
    return out
