"""Entry point: python -m encproxy"""
from encproxy.server import create_app
import os

app, socketio = create_app()

if __name__ == "__main__":
    socketio.run(
        app,
        host=app.config["HOST"],
        port=app.config["PORT"],
        debug=app.config["DEBUG"],
        allow_unsafe_werkzeug=True,
        use_reloader=False,
    )
