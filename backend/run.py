import uvicorn
from a2wsgi import ASGIMiddleware
from app.main import app as asgi_app

# WSGI adapter for standard Gunicorn sync workers
wsgi_app = ASGIMiddleware(asgi_app)


class HybridApp:
    """
    Hybrid WSGI/ASGI application wrapper.
    Routes 2-argument calls (environ, start_response) to WSGI adapter,
    and 3-argument calls (scope, receive, send) to FastAPI ASGI app.
    """
    def __init__(self, asgi, wsgi):
        self.asgi = asgi
        self.wsgi = wsgi

    def __call__(self, *args, **kwargs):
        if len(args) == 2:
            return self.wsgi(*args, **kwargs)
        return self.asgi(*args, **kwargs)


app = HybridApp(asgi_app, wsgi_app)

if __name__ == "__main__":
    uvicorn.run("app.main:app", host="0.0.0.0", port=5050, reload=False)
