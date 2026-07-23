import uuid
from datetime import datetime
from app.core.extensions import db
from app.models.poll import Poll, PollVote
from app.utils.decorators import token_required
from flask import Blueprint, jsonify, request

polls_bp = Blueprint("polls", __name__, url_prefix="/api/v1/polls")


@polls_bp.route("", methods=["POST"])
@token_required
def create_poll(current_user):
    data = request.get_json() or {}
    question = (data.get("question") or "").strip()
    options = data.get("options", [])
    if not question or len(options) < 2:
        return jsonify({"error": "question and at least 2 options required"}), 400

    poll_options = [{"id": uuid.uuid4().hex[:8], "text": str(o)} for o in options]
    poll = Poll(
        id=uuid.uuid4().hex[:16],
        question=question,
        options=poll_options,
        is_anonymous=data.get("is_anonymous", True),
        multiple_choice=data.get("multiple_choice", False),
    )
    db.session.add(poll)
    db.session.commit()
    return jsonify(poll.to_dict()), 201


@polls_bp.route("/<poll_id>", methods=["GET"])
@token_required
def get_poll(current_user, poll_id):
    poll = Poll.query.get(poll_id)
    if not poll:
        return jsonify({"error": "Not found"}), 404
    return jsonify(poll.to_dict())


@polls_bp.route("/<poll_id>/vote", methods=["POST"])
@token_required
def vote(current_user, poll_id):
    poll = Poll.query.get(poll_id)
    if not poll:
        return jsonify({"error": "Not found"}), 404
    if poll.expires_at and poll.expires_at < datetime.utcnow():
        return jsonify({"error": "Poll expired"}), 400

    data = request.get_json() or {}
    option_id = data.get("option_id")
    if not option_id:
        return jsonify({"error": "option_id required"}), 400

    valid_ids = {o["id"] for o in poll.options}
    if option_id not in valid_ids:
        return jsonify({"error": "Invalid option"}), 400

    if not poll.multiple_choice:
        PollVote.query.filter_by(poll_id=poll_id, user_id=str(current_user.id)).delete()

    existing = PollVote.query.filter_by(
        poll_id=poll_id, user_id=str(current_user.id), option_id=option_id).first()
    if existing:
        db.session.delete(existing)
        db.session.commit()
        return jsonify(poll.to_dict())

    vote = PollVote(poll_id=poll_id, user_id=str(current_user.id), option_id=option_id)
    db.session.add(vote)
    db.session.commit()
    return jsonify(poll.to_dict())


@polls_bp.route("/<poll_id>/vote", methods=["DELETE"])
@token_required
def unvote(current_user, poll_id):
    PollVote.query.filter_by(poll_id=poll_id, user_id=str(current_user.id)).delete()
    db.session.commit()
    poll = Poll.query.get(poll_id)
    return jsonify(poll.to_dict() if poll else {"ok": True})
