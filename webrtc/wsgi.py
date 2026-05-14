from webrtc.main import create_app
import eventlet


eventlet.monkey_patch()


app, socketio = create_app()
