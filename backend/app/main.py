import logging
from fastapi import FastAPI, HTTPException, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.api.v1.auth import auth_router
from app.api.v1.upload import upload_router
from app.api.v1.stickers import stickers_router
from app.api.v1.users import users_router
from app.api.v1.bots import bots_router

logger = logging.getLogger(__name__)

app = FastAPI(
    title="Vondic API",
    description="High-performance async API backend for Vondic platform",
    version="2.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
)

# Configure CORS
allowed_origins = [
    "https://vondic.ru",
    "https://vondic.knopusmedia.ru",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:5000",
    "http://localhost:1420",
    "http://127.0.0.1:1420",
    "tauri://localhost",
]
if settings.FRONTEND_URL and settings.FRONTEND_URL not in allowed_origins:
    allowed_origins.append(settings.FRONTEND_URL)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Total-Count"],
)


@app.exception_handler(HTTPException)
async def custom_http_exception_handler(request: Request, exc: HTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": exc.detail},
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    errors = exc.errors()
    first_error = errors[0]["msg"] if errors else "Invalid request data"
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"error": first_error, "details": errors},
    )


# Health check endpoint
@app.get("/healthz", tags=["Health"])
@app.get("/api/v1/healthz", tags=["Health"])
async def healthz():
    return {"status": "ok", "service": "vondic-backend"}


# Register API v1 Routers
app.include_router(auth_router)
app.include_router(upload_router)
app.include_router(stickers_router)
app.include_router(users_router)
app.include_router(bots_router)
