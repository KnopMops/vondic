from flask import Blueprint

from .account import public_account_bp
from .bots import public_bots_bp
from .comments import public_comments_bp
from .messages import public_messages_bp
from .posts import public_posts_bp
from .users import public_users_bp

public_v1_bp = Blueprint("public_v1", __name__)

public_v1_bp.register_blueprint(public_account_bp)
public_v1_bp.register_blueprint(public_bots_bp)
public_v1_bp.register_blueprint(public_posts_bp)
public_v1_bp.register_blueprint(public_users_bp)
public_v1_bp.register_blueprint(public_messages_bp)
public_v1_bp.register_blueprint(public_comments_bp)


@public_v1_bp.before_request
def rate_limit_middleware():
    identifier = get_client_ip(request)
    is_limited, time_left = rate_limiter.is_rate_limited(
        identifier, 100, 60)

    if is_limited:
        return jsonify({
            'success': False,
            'error': 'Rate limit exceeded',
            'message': f'Too many requests. Try again in {time_left} seconds.',
            'retry_after': time_left
        }), 429
