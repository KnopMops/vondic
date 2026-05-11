import eventlet

# Required for Flask-SocketIO under eventlet workers.
eventlet.monkey_patch()

from webrtc.main import create_app  # noqa: E402

app, socketio = create_app()

