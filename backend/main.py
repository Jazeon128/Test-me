import os
import sys
from contextlib import asynccontextmanager
from urllib.parse import urlsplit

from fastapi import Depends, FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException
from sqlalchemy.exc import SQLAlchemyError
from prometheus_client import generate_latest, CONTENT_TYPE_LATEST
from app.config import settings as config_settings

from sqlalchemy.orm import Session
from app.db import get_db, init_db
from app.api import (
    documents,
    questions,
    progress,
    decks,
    tests,
    settings,
    status,
    tags,
    search,
    canvas,
    notebooks,
    activity,
    flagged,
)
from app.utils.logging import configure_logging, get_logger
from app.utils.metrics import application_info
from app.middleware.logging import RequestLoggingMiddleware
from app.middleware.error_handler import (
    testme_exception_handler,
    http_exception_handler,
    validation_exception_handler,
    database_exception_handler,
    generic_exception_handler,
)
from app.exceptions import TestMeException


def _apply_ca_bundle() -> None:
    """Point the HTTP clients at a CA bundle before any of them is built.

    Set CA_BUNDLE when this machine intercepts HTTPS. All three variables are
    set because different libraries read different ones, and an explicitly
    configured bundle overrides whatever the environment already holds: a
    machine-wide variable pointing at a stale bundle is exactly the situation
    this setting exists to correct.
    """
    bundle = config_settings.CA_BUNDLE
    if not bundle:
        return
    if not os.path.exists(bundle):
        print(f"CA_BUNDLE is set to {bundle}, which does not exist", file=sys.stderr)
        return
    os.environ["REQUESTS_CA_BUNDLE"] = bundle
    os.environ["SSL_CERT_FILE"] = bundle
    os.environ["GRPC_DEFAULT_SSL_ROOTS_FILE_PATH"] = bundle


_apply_ca_bundle()


# Configure structured logging
configure_logging(log_level=config_settings.LOG_LEVEL)
logger = get_logger(__name__)

# Create upload directory if it doesn't exist
os.makedirs(config_settings.UPLOAD_DIR, exist_ok=True)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    """Run startup work before serving. Replaces the deprecated on_event hook."""
    await startup_event()
    yield


app = FastAPI(
    lifespan=lifespan,
    title="Test Me - AI-Powered Learning Platform",
    description="Upload documents, generate questions, and learn with spaced repetition",
    version="1.0.0",
)

# Request logging middleware (add before CORS)
app.add_middleware(RequestLoggingMiddleware)

# CORS middleware: file pages have an opaque origin only allowed in desktop mode.
allowed_origins = list(config_settings.CORS_ORIGINS)
if os.environ.get("DESKTOP_MODE") == "true":
    allowed_origins.append("null")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def is_cross_site_write(method, origin, fetch_site, allowed_origins):
    """Decide whether a browser write comes from an untrusted site."""
    if method not in {"POST", "PUT", "PATCH", "DELETE"}:
        return False
    if origin is not None:
        if any((origin in allowed_origins, origin == "null", origin.startswith("file://"))):
            return False
        try:
            parsed = urlsplit(origin)
            host = parsed.hostname or ""
        except ValueError:
            return True
        loopback = host in {"localhost", "127.0.0.1", "::1"} or host.endswith(".localhost")
        return not (parsed.scheme in {"http", "https"} and loopback)
    return fetch_site == "cross-site"


@app.middleware("http")
async def check_write_origin(request: Request, call_next):
    if is_cross_site_write(
        request.method,
        request.headers.get("origin"),
        request.headers.get("sec-fetch-site"),
        config_settings.CORS_ORIGINS,
    ):
        return await http_exception_handler(
            request,
            StarletteHTTPException(status_code=403, detail="Cross-site requests are not allowed."),
        )
    return await call_next(request)


# Register exception handlers
app.add_exception_handler(TestMeException, testme_exception_handler)
app.add_exception_handler(StarletteHTTPException, http_exception_handler)
app.add_exception_handler(RequestValidationError, validation_exception_handler)
app.add_exception_handler(SQLAlchemyError, database_exception_handler)
app.add_exception_handler(Exception, generic_exception_handler)


async def startup_event():
    """
    Initialize database on startup
    Optimized for fast startup (Requirements 8.2: Target 3 second startup time)
    """
    import time

    startup_start = time.time()

    # Validate configuration before starting (fast operation)
    config_settings.validate_required_settings()

    # Initialize database with optimizations
    # Only create tables if they don't exist (fast check)
    init_db()
    logger.info("database_initialized", status="success")

    # Set application info metrics (fast operation)
    application_info.info(
        {
            "version": "1.0.0",
            "ai_provider": config_settings.AI_PROVIDER,
            "environment": config_settings.ENVIRONMENT,
        }
    )

    # Log configured API keys (fast operation)
    api_keys_configured = []
    if config_settings.ANTHROPIC_API_KEY:
        logger.info("api_key_configured", provider="anthropic")
        api_keys_configured.append("anthropic")
    if config_settings.OPENAI_API_KEY:
        logger.info("api_key_configured", provider="openai")
        api_keys_configured.append("openai")
    if config_settings.GEMINI_API_KEY:
        logger.info("api_key_configured", provider="gemini")
        api_keys_configured.append("gemini")

    startup_duration = time.time() - startup_start
    logger.info(
        "configuration_validated",
        environment=config_settings.ENVIRONMENT,
        log_level=config_settings.LOG_LEVEL,
        ai_provider=config_settings.AI_PROVIDER,
        api_keys_configured=api_keys_configured,
        startup_duration_seconds=round(startup_duration, 3),
    )


@app.get("/")
async def root(db: Session = Depends(get_db)):
    return {
        "message": "Test Me API",
        "version": "1.0.0",
        "docs": "/docs",
        "ai_configured": ai_status(db)["ai_configured"],
    }


def ai_status(db):
    """The generation provider and whether any provider key is available.

    Keys live in the OS credential store, then backend/.env, then a legacy
    database row, so reading only the environment missed stored keys.
    """
    from app.api.settings import get_setting
    from app.services import secrets

    provider = (get_setting(db, "generation_provider") or get_setting(db, "ai_provider")
                or config_settings.AI_PROVIDER)
    configured = any(secrets.secret_status(name, db=db)["configured"]
                     for name in ("anthropic", "openai", "gemini", "openrouter"))
    return {"ai_provider": provider, "ai_configured": configured}


@app.get("/health")
async def health_check(db: Session = Depends(get_db)):
    return {
        "status": "healthy",
        **ai_status(db),
    }


@app.get("/metrics")
async def metrics():
    """
    Prometheus metrics endpoint

    Returns metrics in Prometheus text format for scraping.

    Available metrics:
    - question_generation_duration_seconds: Time spent generating questions
    - question_generation_total: Total question generation requests
    - questions_generated_count: Total questions generated
    - ai_api_calls_total: Total AI API calls
    - ai_api_duration_seconds: Duration of AI API calls
    - ai_tokens_used_total: Total tokens used
    - ai_estimated_cost_usd: Estimated AI API costs
    - api_requests_total: Total API requests
    - api_request_duration_seconds: API request duration
    - db_query_duration_seconds: Database query duration
    - db_operations_total: Total database operations
    - document_uploads_total: Total document uploads
    - document_parsing_duration_seconds: Document parsing duration
    - document_size_bytes: Document sizes
    - answers_submitted_total: Total answers submitted
    - review_sessions_total: Total review sessions
    - errors_total: Total errors
    - active_users: Currently active users
    - application_info: Application version and configuration
    """
    return Response(content=generate_latest(), media_type=CONTENT_TYPE_LATEST)


# Include routers
app.include_router(documents.router, prefix="/api/documents", tags=["documents"])
app.include_router(flagged.router, prefix="/api/flagged", tags=["flagged"])
app.include_router(questions.router, prefix="/api/questions", tags=["questions"])
app.include_router(status.router, prefix="/api/status", tags=["status"])
app.include_router(decks.router, prefix="/api/decks", tags=["decks"])
app.include_router(
    tests.router, prefix="/api/tests", tags=["tests (deprecated)"]
)  # Backward compatibility
app.include_router(progress.router, prefix="/api/progress", tags=["progress"])
app.include_router(settings.router, prefix="/api/settings", tags=["settings"])
app.include_router(tags.router, prefix="/api/tags", tags=["tags"])
app.include_router(search.router, prefix="/api/search", tags=["search"])
app.include_router(canvas.router, prefix="/api/canvas", tags=["canvas"])
app.include_router(notebooks.router, prefix="/api/notebooks", tags=["notebooks"])
app.include_router(activity.router, prefix="/api/activity", tags=["activity"])


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host=config_settings.HOST, port=config_settings.PORT)
