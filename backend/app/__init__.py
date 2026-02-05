from flask import Flask

from app.core.config import Config
from app.core.extensions import cors, db, ma, mail, migrate


def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)

    db.init_app(app)
    migrate.init_app(app, db)
    ma.init_app(app)
    cors.init_app(app)
    mail.init_app(app)

    from app.api.v1.auth import auth_bp
    from app.api.v1.users import users_bp

    app.register_blueprint(users_bp)
    app.register_blueprint(auth_bp)

    @app.route("/health")
    def health_check():
        return {"status": "ok", "service": "backend-core"}

    return app
