from flasgger import Swagger
from flask import Flask
from sqlalchemy import text

from app.core.config import Config
from app.core.extensions import cors, db, ma, mail, migrate


def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)
    db.init_app(app)
    migrate.init_app(app, db)
    ma.init_app(app)

    allowed_origins = [
        "https://poisonously-beloved-fawn.cloudpub.ru",
        "http://localhost:3000",
        "http://localhost:5000"
    ]
    cors.init_app(app, resources={
                  r"/*": {"origins": allowed_origins}}, supports_credentials=True)

    mail.init_app(app)

    # Initialize Flasgger
    swagger_config = {
        "headers": [],
        "specs": [
            {
                "endpoint": "apispec",
                "route": "/apispec.json",
                "rule_filter": lambda rule: True,
                "model_filter": lambda tag: True,
            }
        ],
        "static_url_path": "/flasgger_static",
        "swagger_ui": True,
        "specs_route": "/docs/",
        "info": {
            "title": "Vondic Backend API",
            "description": "API документация для бэкенда Vondic",
            "version": "1.0.0",
        },
    }
    Swagger(app, config=swagger_config)

    # Import models to ensure they are registered
    from app import models  # noqa: F401

    with app.app_context():
        if db.engine.dialect.name == "sqlite":
            cols = db.session.execute(text("PRAGMA table_info(messages)")).fetchall()
            column_names = [c[1] for c in cols]
            if column_names and "attachments" not in column_names:
                db.session.execute(text("ALTER TABLE messages ADD COLUMN attachments TEXT"))
                db.session.commit()
    from app.api.v1.auth import auth_bp
    from app.api.v1.channels import channels_bp
    from app.api.v1.comments import comments_bp
    from app.api.v1.friends import friends_bp
    from app.api.v1.groups import groups_bp
    from app.api.v1.posts import posts_bp
    from app.api.v1.search import search_bp
    from app.api.v1.subscriptions import subscriptions_bp
    from app.api.v1.upload import upload_bp
    from app.api.v1.users import users_bp

    app.register_blueprint(users_bp)
    app.register_blueprint(auth_bp)
    app.register_blueprint(channels_bp)
    app.register_blueprint(groups_bp)
    app.register_blueprint(posts_bp)
    app.register_blueprint(comments_bp)
    app.register_blueprint(friends_bp)
    app.register_blueprint(subscriptions_bp)
    app.register_blueprint(search_bp)
    app.register_blueprint(upload_bp)

    @app.route("/health")
    def health_check():
        return {"status": "ok", "service": "backend-core"}

    return app
