"""V2 Analytics API — bot analytics and statistics."""
import logging
import time
from flask import Blueprint, request, jsonify
from app.api.public.v1.bots import _verify_bot_token
from app.api.v2.errors import not_found, api_error

logger = logging.getLogger(__name__)

v2_analytics_bp = Blueprint("v2_analytics", __name__, url_prefix="/api/public/v2/bots")


@v2_analytics_bp.route("/<bot_id>/analytics", methods=["GET"])
def get_bot_analytics(bot_id):
    """Get bot analytics for a time period."""
    try:
        _, error_response = _verify_bot_token(bot_id)
        if error_response:
            return error_response

        period = request.args.get("period", "7d")
        period_days = {"1d": 1, "7d": 7, "30d": 30, "90d": 90}.get(period, 7)

        # Get analytics from Redis counters
        import redis as redis_mod
        import os
        r = redis_mod.Redis(
            host=os.environ.get("REDIS_HOST", "redis"),
            port=int(os.environ.get("REDIS_PORT", 6379)),
            db=0, decode_responses=True,
        )

        # Count messages from Redis daily counters
        total_sent = 0
        total_received = 0
        unique_users = set()
        commands = {}

        for day_offset in range(period_days):
            day_key = time.strftime("%Y-%m-%d", time.localtime(time.time() - day_offset * 86400))
            sent = r.get(f"analytics:{bot_id}:{day_key}:sent") or 0
            received = r.get(f"analytics:{bot_id}:{day_key}:received") or 0
            total_sent += int(sent)
            total_received += int(received)

            # Get unique users
            users = r.smembers(f"analytics:{bot_id}:{day_key}:users") or set()
            unique_users.update(users)

            # Get command counts
            cmds = r.hgetall(f"analytics:{bot_id}:{day_key}:commands") or {}
            for cmd, count in cmds.items():
                commands[cmd] = commands.get(cmd, 0) + int(count)

        # Sort commands by count
        top_commands = sorted(
            [{"command": cmd, "count": cnt} for cmd, cnt in commands.items()],
            key=lambda x: x["count"],
            reverse=True,
        )[:10]

        # Get active hours (last 24h)
        active_hours = []
        today_key = time.strftime("%Y-%m-%d")
        hourly = r.hgetall(f"analytics:{bot_id}:{today_key}:hourly") or {}
        for hour in range(24):
            if int(hourly.get(str(hour), 0)) > 0:
                active_hours.append(hour)

        # Average response time
        avg_response = r.get(f"analytics:{bot_id}:avg_response_ms") or 0

        return jsonify({
            "bot_id": bot_id,
            "period": period,
            "messages_sent": total_sent,
            "messages_received": total_received,
            "unique_users": len(unique_users),
            "top_commands": top_commands,
            "active_hours": active_hours,
            "avg_response_time_ms": int(avg_response),
            "generated_at": int(time.time()),
        }), 200

    except Exception as e:
        logger.exception("bot_analytics_error bot_id=%s", bot_id)
        return jsonify({"error": str(e)[:200]}), 500


def track_bot_event(bot_id, event_type, data=None):
    """Track a bot analytics event. Called from bot methods."""
    try:
        import redis as redis_mod
        import os
        r = redis_mod.Redis(
            host=os.environ.get("REDIS_HOST", "redis"),
            port=int(os.environ.get("REDIS_PORT", 6379)),
            db=0, decode_responses=True,
        )

        day_key = time.strftime("%Y-%m-%d")
        hour = str(time.localtime().tm_hour)

        if event_type == "message_sent":
            r.incr(f"analytics:{bot_id}:{day_key}:sent")
        elif event_type == "message_received":
            r.incr(f"analytics:{bot_id}:{day_key}:received")
            if data and data.get("user_id"):
                r.sadd(f"analytics:{bot_id}:{day_key}:users", data["user_id"])
            if data and data.get("command"):
                r.hincrby(f"analytics:{bot_id}:{day_key}:commands", data["command"], 1)
        elif event_type == "response_time":
            r.set(f"analytics:{bot_id}:avg_response_ms", data.get("ms", 0))

        r.hincrby(f"analytics:{bot_id}:{day_key}:hourly", hour, 1)
    except Exception:
        pass  # Don't fail requests on analytics errors
