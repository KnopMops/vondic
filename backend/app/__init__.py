import importlib
import os
import time

from flasgger import Swagger
from flask import Flask, Response, request
from prometheus_client import Counter, Gauge, Histogram, generate_latest

from app.core.config import Config
from app.core.extensions import cache, cors, db, ma, mail, migrate

REQUEST_COUNT = Counter(
    "http_requests_total", "Total HTTP requests", [
        "method", "endpoint", "status"])
REQUEST_LATENCY = Histogram(
    "http_request_duration_seconds", "HTTP request latency", [
        "method", "endpoint"])
REQUEST_IN_PROGRESS = Gauge(
    "http_requests_in_progress", "HTTP requests in progress", [
        "method", "endpoint"])


def _tag_for_rule(rule: str) -> str:
    parts = [p for p in rule.split("/") if p]
    if len(parts) >= 3 and parts[0] == "api" and parts[1] == "v1":
        key = parts[2]
    elif parts:
        key = parts[0]
    else:
        key = "other"
    mapping = {
        "auth": "Auth",
        "users": "Users",
        "channels": "Channels",
        "groups": "Groups",
        "posts": "Posts",
        "comments": "Comments",
        "friends": "Friends",
        "subscriptions": "Subscriptions",
        "search": "Search",
        "upload": "Upload",
        "payments": "Payments",
        "gifts": "Gifts",
        "communities": "Communities",
        "dm": "Direct Messages",
        "storis": "Stories",
        "support": "Support",
        "health": "Health",
    }
    return mapping.get(key, key.replace("-", " ").title())


def _build_swagger_paths(app: Flask):
    paths = {}
    for rule in app.url_map.iter_rules():
        if rule.endpoint == "static":
            continue
        if rule.rule.startswith("/flasgger_static"):
            continue
        if rule.rule in ("/apispec.json", "/docs/"):
            continue
        methods = sorted(m for m in rule.methods if m not in {
                         "HEAD", "OPTIONS"})
        if not methods:
            continue
        view = app.view_functions.get(rule.endpoint)
        is_auth = bool(getattr(view, "_auth_required", False))
        tags = [_tag_for_rule(rule.rule)]
        if "/admin/" in rule.rule:
            tags.append("Admin")
        tags.append("Protected" if is_auth else "Public")
        entry = paths.setdefault(rule.rule, {})
        for method in methods:
            responses = {"200": {"description": "Success"}}
            if is_auth:
                responses["401"] = {"description": "Unauthorized"}
            entry[method.lower()] = {
                "summary": rule.endpoint,
                "tags": tags,
                "responses": responses,
            }
            if is_auth:
                entry[method.lower()]["security"] = [{"Bearer": []}]
    return paths


def _build_allowed_origins() -> list[str]:
    defaults = [
        "https://vondic.knopusmedia.ru",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5000",
        "http://localhost:1420",
        "http://127.0.0.1:1420",
        "tauri://localhost",
    ]
    raw = os.getenv("CORS_ALLOWED_ORIGINS", "")
    extra = [origin.strip() for origin in raw.split(",") if origin.strip()]
    frontend_url = os.getenv("FRONTEND_URL")
    if frontend_url:
        extra.append(frontend_url)
    merged = []
    seen = set()
    for origin in defaults + extra:
        if origin not in seen:
            merged.append(origin)
            seen.add(origin)
    return merged


def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)
    app.url_map.strict_slashes = False
    db.init_app(app)
    migrate.init_app(app, db)
    ma.init_app(app)
    cache.init_app(app)

    mail.init_app(app)

    importlib.import_module("app.models")

    with app.app_context():
        if not os.environ.get("SKIP_DB_BOOTSTRAP"):
            db.create_all()
            db.session.rollback()

            try:
                from app.models.gift_catalog import GiftCatalog

                if GiftCatalog.query.count() == 0:
                    seed_items = [
                        ("newyear_fireworks", "Новогодний салют", 99, "Flame", "Праздничное настроение на Новый год"),
                        ("valentine_heart", "Валентинка", 39, "Heart", "Для Дня святого Валентина"),
                        ("womens_day_bouquet", "Букет к 8 Марта", 149, "Flower", "Милый букет для прекрасных дам"),
                        ("birthday_cake", "День рождения", 299, "Cake", "Поздравляем с днем рождения!"),
                        ("premium_crown", "Премиум корона", 999, "Crown", "Самая престижная награда"),
                    ]
                    for item in seed_items:
                        db.session.add(
                            GiftCatalog(
                                id=item[0],
                                name=item[1],
                                coin_price=item[2],
                                icon=item[3],
                                description=item[4],
                                image_url=None,
                                total_supply=None,
                                minted_count=0,
                            )
                        )
                    db.session.commit()
            except Exception:
                db.session.rollback()

            try:
                from app.services.ollama_service import OllamaService

                OllamaService.get_ai_user()
            except Exception as e:
                print(f"Failed to ensure AI user: {e}")

    from app.api.public.v1.account import public_account_bp
    from app.api.public.v1.bots import public_bots_bp
    from app.api.public.v1.comments import public_comments_bp
    from app.api.public.v1.messages import public_messages_bp
    from app.api.public.v1.posts import public_posts_bp
    from app.api.public.v1.users import public_users_bp
    from app.api.v1.auth import auth_bp
    from app.api.v1.bots import bots_bp
    from app.api.v1.channels import channels_bp
    from app.api.v1.comments import comments_bp
    from app.api.v1.communities import communities_bp
    from app.api.v1.e2e_keys import e2e_keys_bp
    from app.api.v1.direct_messages import dm_bp
    from app.api.v1.friends import friends_bp
    from app.api.v1.gifts import gifts_bp
    from app.api.v1.groups import groups_bp
    from app.api.v1.messages import messages_bp
    from app.api.v1.payments import payments_bp
    from app.api.v1.posts import posts_bp
    from app.api.v1.search import search_bp
    from app.api.v1.storis import storis_bp
    from app.api.v1.subscriptions import subscriptions_bp
    from app.api.v1.support import support_bp
    from app.api.v1.playlists import playlists_bp
    from app.api.v1.users import users_bp
    from app.api.v1.videos import videos_bp
    from app.api.v1.upload import upload_bp
    from app.api.v1.files import files_bp

    app.register_blueprint(public_account_bp)
    app.register_blueprint(public_bots_bp)
    app.register_blueprint(public_comments_bp)
    app.register_blueprint(public_messages_bp)
    app.register_blueprint(public_posts_bp)
    app.register_blueprint(public_users_bp)
    app.register_blueprint(auth_bp)
    app.register_blueprint(bots_bp)
    app.register_blueprint(channels_bp)
    app.register_blueprint(comments_bp)
    app.register_blueprint(communities_bp)
    app.register_blueprint(e2e_keys_bp)
    app.register_blueprint(dm_bp)
    app.register_blueprint(friends_bp)
    app.register_blueprint(gifts_bp)
    app.register_blueprint(groups_bp)
    app.register_blueprint(messages_bp)
    app.register_blueprint(payments_bp)
    app.register_blueprint(posts_bp)
    app.register_blueprint(search_bp)
    app.register_blueprint(storis_bp)
    app.register_blueprint(subscriptions_bp)
    app.register_blueprint(support_bp)
    app.register_blueprint(playlists_bp)
    app.register_blueprint(users_bp)
    app.register_blueprint(videos_bp)
    app.register_blueprint(upload_bp)
    app.register_blueprint(files_bp)

    swagger_config = {
        "headers": [],
        "specs": [
            {
                "endpoint": 'apispec_json',
                "route": '/docs.json',
                "rule_filter": lambda rule: True,
                "model_filter": lambda tag: True,
            }
        ],
        "static_url_path": "/flasgger_static",
        "swagger_ui": True,
        "specs_route": "/docs/",
        "info": {
            "title": "Vondic API",
            "description": "API documentation for Vondic application",
            "version": "1.0",
            "contact": {
                "email": "support@vondic.com",
            },
        },
        "paths": _build_swagger_paths(app),
    }

    swagger = Swagger(app, config=swagger_config)

    @app.after_request
    def after_request(response):
        response.headers.add('Access-Control-Expose-Headers', 'X-Total-Count')
        return response

    @app.before_request
    def before_request_metrics():
        endpoint = request.endpoint or "unknown"
        REQUEST_IN_PROGRESS.labels(
            method=request.method,
            endpoint=endpoint).inc()
        request.start_time = time.time()

    @app.after_request
    def after_request_metrics(response):
        endpoint = request.endpoint or "unknown"
        status = response.status_code
        REQUEST_COUNT.labels(
            method=request.method,
            endpoint=endpoint,
            status=status).inc()
        REQUEST_IN_PROGRESS.labels(
            method=request.method,
            endpoint=endpoint).dec()
        if hasattr(request, 'start_time') and request.start_time:
            latency = time.time() - request.start_time
            REQUEST_LATENCY.labels(
                method=request.method,
                endpoint=endpoint).observe(latency)
        return response

    from flask import send_from_directory, request, jsonify, Response
    import requests as http_requests

    STATIC_NGINX_URL = os.getenv('STATIC_NGINX_URL', 'http://static-nginx:80')

    @app.route('/static/<path:filename>')
    def serve_static(filename):
        remote_addr = request.remote_addr or ""

        is_internal = remote_addr.startswith('172.') or remote_addr.startswith(
            '192.168.') or remote_addr.startswith('10.')

        is_authorized = False

        if is_internal:
            is_authorized = True
        else:
            token = request.args.get("access_token") or request.headers.get(
                "Authorization", "").replace("Bearer ", "")
            if token:
                try:
                    from app.services.auth_service import AuthService
                    user, error = AuthService.get_user_by_token(token)
                    if user:
                        is_authorized = True
                except Exception:
                    pass

            api_key = request.args.get(
                "api_key") or request.headers.get("X-API-Key")
            if api_key:
                try:
                    from app.services.user_service import UserService
                    user = UserService.get_user_by_api_key(api_key)
                    if user:
                        is_authorized = True
                except Exception:
                    pass

            origin = request.headers.get("Origin", "")
            allowed_origins = _build_allowed_origins()
            if origin in allowed_origins:
                is_authorized = True

        if not is_authorized:
            return jsonify(
                {"error": "Unauthorized access to static resource"}), 401

        try:
            if filename.startswith('uploads/'):
                static_url = f"{STATIC_NGINX_URL}/{filename}"
            else:
                static_url = f"{STATIC_NGINX_URL}/static/{filename}"

            if request.query_string:
                static_url += f"?{request.query_string.decode('utf-8')}"

            resp = http_requests.request(
                method=request.method,
                url=static_url,
                headers={
                    key: value for key,
                    value in request.headers if key.lower() != 'host'},
                data=request.get_data(),
                cookies=request.cookies,
                allow_redirects=False,
                timeout=10)

            excluded_headers = {
                'content-encoding',
                'content-length',
                'transfer-encoding',
                'connection'}
            headers = [
                (name, value)
                for name, value in resp.raw.headers.items()
                if name.lower() not in excluded_headers
            ]

            return Response(resp.content, resp.status_code, headers)
        except http_requests.exceptions.ConnectionError:
            static_folder = os.path.join(os.path.dirname(__file__), 'static')
            return send_from_directory(static_folder, filename)
        except http_requests.exceptions.Timeout:
            return jsonify({"error": "Static service timeout"}), 504
        except Exception as e:
            import traceback
            print(f"Error proxying to static nginx: {e}")
            print(traceback.format_exc())
            static_folder = os.path.join(os.path.dirname(__file__), 'static')
            return send_from_directory(static_folder, filename)

    @app.route('/uploads/<path:filename>')
    def serve_uploads(filename):
        try:
            uploads_url = f"{STATIC_NGINX_URL}/uploads/{filename}"
            if request.query_string:
                uploads_url += f"?{request.query_string.decode('utf-8')}"

            resp = http_requests.request(
                method=request.method,
                url=uploads_url,
                headers={
                    key: value for key,
                    value in request.headers if key.lower() != 'host'},
                data=request.get_data(),
                cookies=request.cookies,
                allow_redirects=False,
                timeout=10)

            excluded_headers = {
                'content-encoding',
                'content-length',
                'transfer-encoding',
                'connection'}
            headers = [
                (name, value)
                for name, value in resp.raw.headers.items()
                if name.lower() not in excluded_headers
            ]

            return Response(resp.content, resp.status_code, headers)
        except http_requests.exceptions.ConnectionError:
            uploads_folder = os.getenv('UPLOADS_DIR', '/app/uploads')
            return send_from_directory(uploads_folder, filename)
        except http_requests.exceptions.Timeout:
            return jsonify({"error": "Uploads service timeout"}), 504
        except Exception as e:
            print(f"Error proxying to static nginx for uploads: {e}")
            uploads_folder = os.getenv('UPLOADS_DIR', '/app/uploads')
            return send_from_directory(uploads_folder, filename)

    @app.route("/metrics")
    def metrics():
        return Response(
            generate_latest(),
            mimetype="text/plain; charset=utf-8")

    return app
