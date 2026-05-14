"""Автоудаление постов по истечении 24 ч после запроса модерации + предупреждения."""
from __future__ import annotations

import time
import uuid
from datetime import datetime

from app.core.config import Config
from app.core.extensions import db
from app.models.post import Post
from app.models.post_report import PostReport
from app.models.user import User
from app.services.post_service import PostService

_LAST_SWEEP_MONO = 0.0
SWEEP_MIN_INTERVAL_SEC = 90.0

SYSTEM_ACTOR_ID = "system_auto_moderation"
AUTO_REASON = (
    "Автоматическое удаление: вы не удалили пост в течение 24 часов "
    "после предупреждения модерации."
)


def append_moderation_warning(
    user_id: str,
    kind: str,
    message: str,
    post_id: str | None = None,
    report_id: int | None = None,
):
    user = User.query.get(str(user_id))
    if not user:
        return
    items = list(getattr(user, "moderation_warnings", None) or [])
    items.append(
        {
            "id": str(uuid.uuid4()),
            "kind": kind,
            "message": message,
            "created_at": datetime.utcnow().isoformat(),
            "post_id": post_id,
            "report_id": report_id,
        }
    )
    user.moderation_warnings = items[-100:]


def enforce_removal_deadlines() -> int:
    """Возвращает число принудительно удалённых постов."""
    from app.api.v1.support import notify_user

    now_ts = int(time.time())
    rows = PostReport.query.filter_by(status="removal_requested").all()
    removed = 0
    frontend = Config.FRONTEND_URL
    handled_post_ids: set[str] = set()

    for r in rows:
        verdict_at = r.verdict_at
        if not verdict_at:
            verdict_at = int(r.created_at.timestamp()
                             ) if r.created_at else now_ts
        if now_ts < verdict_at + 86400:
            continue

        pid = str(r.post_id)
        if pid in handled_post_ids:
            r.status = "closed"
            continue

        post = Post.query.filter_by(id=pid, deleted=False).first()
        if not post:
            r.status = "closed"
            continue

        author_id = str(post.posted_by)
        post_url = f"{frontend}/feed?postId={pid}"
        _, err = PostService.delete_post_by_admin(
            pid, SYSTEM_ACTOR_ID, AUTO_REASON
        )
        if err:
            continue

        removed += 1
        handled_post_ids.add(pid)
        PostReport.query.filter(
            PostReport.post_id == pid,
            PostReport.status == "removal_requested",
        ).update({"status": "closed"}, synchronize_session=False)

        warn_msg = (
            "Вы не удалили пост в срок (24 ч) после предупреждения модерации. "
            f"Контент удалён автоматически. {post_url}"
        )
        append_moderation_warning(
            author_id,
            "removal_deadline_missed",
            warn_msg,
            post_id=pid,
            report_id=r.id,
        )
        notify_user(
            author_id,
            warn_msg,
            title="Предупреждение модерации",
            notification_type="moderation",
            send_email_copy=True,
        )

    try:
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        print(f"enforce_removal_deadlines commit: {e}")
    return removed


def enforce_removal_deadlines_throttled() -> None:
    global _LAST_SWEEP_MONO
    now = time.monotonic()
    if now - _LAST_SWEEP_MONO < SWEEP_MIN_INTERVAL_SEC:
        return
    _LAST_SWEEP_MONO = now
    try:
        enforce_removal_deadlines()
    except Exception as e:
        print(f"enforce_removal_deadlines: {e}")
