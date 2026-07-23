"""V2 Marketplace API — bot catalog, reviews, installs."""
import logging
from flask import Blueprint, request, jsonify
from app.api.v2.errors import not_found, validation_error

logger = logging.getLogger(__name__)

v2_marketplace_bp = Blueprint("v2_marketplace", __name__, url_prefix="/api/public/v2/marketplace")


def _get_redis():
    import redis as redis_mod
    import os
    return redis_mod.Redis(
        host=os.environ.get("REDIS_HOST", "redis"),
        port=int(os.environ.get("REDIS_PORT", 6379)),
        db=0, decode_responses=True,
    )


@v2_marketplace_bp.route("/bots", methods=["GET"])
def list_marketplace_bots():
    """List bots in the marketplace."""
    category = request.args.get("category", "")
    sort = request.args.get("sort", "popular")  # popular, newest, rating
    limit = min(int(request.args.get("limit", 20)), 50)
    offset = int(request.args.get("offset", 0))

    r = _get_redis()

    # Get bot IDs from sorted sets
    if sort == "popular":
        bot_ids = r.zrevrange("marketplace:bots:installs", offset, offset + limit - 1)
    elif sort == "newest":
        bot_ids = r.zrevrange("marketplace:bots:created", offset, offset + limit - 1)
    elif sort == "rating":
        bot_ids = r.zrevrange("marketplace:bots:rating", offset, offset + limit - 1)
    else:
        bot_ids = r.zrevrange("marketplace:bots:installs", offset, offset + limit - 1)

    bots = []
    for bid in bot_ids:
        data = r.hgetall(f"marketplace:bot:{bid}")
        if data:
            data["id"] = bid
            data["installs"] = int(data.get("installs", 0))
            data["rating"] = float(data.get("rating", 0))
            if category and data.get("category") != category:
                continue
            bots.append(data)

    total = r.zcard("marketplace:bots:installs") or 0

    return jsonify({
        "bots": bots,
        "total": total,
        "offset": offset,
        "limit": limit,
    }), 200


@v2_marketplace_bp.route("/bots/<bot_id>", methods=["GET"])
def get_marketplace_bot(bot_id):
    """Get bot details from marketplace."""
    r = _get_redis()
    data = r.hgetall(f"marketplace:bot:{bot_id}")
    if not data:
        return not_found("Bot not found in marketplace")

    data["id"] = bot_id
    data["installs"] = int(data.get("installs", 0))
    data["rating"] = float(data.get("rating", 0))

    # Get reviews
    review_ids = r.zrevrange(f"marketplace:bot:{bot_id}:reviews", 0, 19) or []
    reviews = []
    for rid in review_ids:
        review = r.hgetall(f"marketplace:review:{rid}")
        if review:
            reviews.append(review)

    data["reviews"] = reviews
    return jsonify(data), 200


@v2_marketplace_bp.route("/bots/<bot_id>/install", methods=["POST"])
def install_bot(bot_id):
    """Record a bot installation."""
    from app.api.v1.bots import _verify_bot_token
    _, error_response = _verify_bot_token(bot_id)
    if error_response:
        return error_response

    r = _get_redis()

    # Increment install count
    r.zincrby("marketplace:bots:installs", 1, bot_id)
    r.hincrby(f"marketplace:bot:{bot_id}", "installs", 1)

    logger.info("marketplace_install bot_id=%s", bot_id)
    return jsonify({"ok": True}), 200


@v2_marketplace_bp.route("/bots/<bot_id>/reviews", methods=["POST"])
def add_review(bot_id):
    """Add a review for a bot."""
    from app.utils.decorators import token_required
    from flask import g

    data = request.get_json() or {}
    rating = data.get("rating", 5)
    text = data.get("text", "")

    if not (1 <= rating <= 5):
        return validation_error("Rating must be 1-5", field="rating")

    import uuid
    review_id = str(uuid.uuid4())[:12]
    r = _get_redis()

    r.hset(f"marketplace:review:{review_id}", mapping={
        "id": review_id,
        "bot_id": bot_id,
        "user_id": getattr(g, "current_user_id", "anonymous"),
        "rating": str(rating),
        "text": text[:500],
    })
    r.zadd(f"marketplace:bot:{bot_id}:reviews", {review_id: rating})

    # Update average rating
    reviews = r.zrange(f"marketplace:bot:{bot_id}:reviews", 0, -1, withscores=True)
    if reviews:
        avg_rating = sum(score for _, score in reviews) / len(reviews)
        r.hset(f"marketplace:bot:{bot_id}", "rating", str(round(avg_rating, 2)))
        r.zadd("marketplace:bots:rating", {bot_id: avg_rating})

    return jsonify({"ok": True, "review_id": review_id}), 201


@v2_marketplace_bp.route("/bots/<bot_id>/reviews", methods=["GET"])
def list_reviews(bot_id):
    """List reviews for a bot."""
    r = _get_redis()
    review_ids = r.zrevrange(f"marketplace:bot:{bot_id}:reviews", 0, 49) or []
    reviews = []
    for rid in review_ids:
        review = r.hgetall(f"marketplace:review:{rid}")
        if review:
            reviews.append(review)
    return jsonify({"reviews": reviews}), 200
