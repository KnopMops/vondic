from app import create_app

app = create_app()


def _send_scheduled(msg):
    """Send a scheduled message via webrtc broker or direct DB."""
    import json
    from datetime import datetime

    target_user = msg.target_user_id
    channel_id = msg.channel_id
    group_id = msg.group_id
    sender_id = msg.sender_id
    content = msg.content
    msg_type = msg.type or "text"
    attachments = msg.attachments or []
    message_id = msg.id

    msg_data = {
        "id": message_id,
        "sender_id": sender_id,
        "content": content,
        "type": msg_type,
        "attachments": attachments,
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "is_read": 0,
    }
    if target_user:
        msg_data["target_id"] = target_user
    if channel_id:
        msg_data["channel_id"] = channel_id
    if group_id:
        msg_data["group_id"] = group_id

    try:
        import requests
        resp = requests.post("http://webrtc:5000/internal/send_scheduled", json=msg_data, timeout=5)
        if not resp.ok:
            raise Exception("webrtc not available")
    except Exception:
        from app.core.extensions import db
        from app.models.message import Message
        db.session.add(Message(
            id=message_id, sender_id=sender_id, target_id=target_user,
            channel_id=channel_id, group_id=group_id, content=content,
            type=msg_type, attachments=json.dumps(attachments) if attachments else None,
        ))
        db.session.commit()


# Start scheduler inside app context
with app.app_context():
    from app.services.scheduler import init_scheduler
    init_scheduler(_send_scheduled, app)

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5050, threaded=True)
