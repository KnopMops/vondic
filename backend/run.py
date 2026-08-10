import uvicorn
from a2wsgi import ASGIMiddleware
from app.main import app as asgi_app

# Pure FastAPI ASGI 3 application
app = asgi_app

# WSGI adapter for legacy/sync WSGI servers
wsgi_app = ASGIMiddleware(asgi_app)

if __name__ == "__main__":
    uvicorn.run("app.main:app", host="0.0.0.0", port=5050, reload=False)
