import os

bind = "0.0.0.0:5050"
worker_class = "uvicorn.workers.UvicornWorker"
workers = int(os.environ.get("GUNICORN_WORKERS", "4"))
timeout = 120
keepalive = 5
max_requests = 1000
max_requests_jitter = 50
