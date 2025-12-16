from fastapi import FastAPI, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException
from sqlalchemy.exc import SQLAlchemyError
from prometheus_client import generate_latest, CONTENT_TYPE_LATEST
from app.config import settings as config_settings
from app.db import init_db
from app.api import documents, questions, progress, decks, tests, settings, status, tags, search
from app.utils.logging import configure_logging, get_logger
from app.utils.metrics import application_info
from app.middleware.logging import RequestLoggingMiddleware
from app.middleware.error_handler import (
    testme_exception_handler,
    http_exception_handler,
    validation_exception_handler,
    database_exception_handler,
    generic_exception_handler
)
from app.exceptions import TestMeException
import os

# Configure structured logging
configure_logging(log_level=config_settings.LOG_LEVEL)
logger = get_logger(__name__)

# Create upload directory if it doesn't exist
os.makedirs(config_settings.UPLOAD_DIR, exist_ok=True)

app = FastAPI(
    title="Test Me - AI-Powered Learning Platform",
    description="Upload documents, generate questions, and learn with spaced repetition",
    version="1.0.0",
)

# Request logging middleware (add before CORS)
app.add_middleware(RequestLoggingMiddleware)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=config_settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register exception handlers
app.add_exception_handler(TestMeException, testme_exception_handler)
app.add_exception_handler(StarletteHTTPException, http_exception_handler)
app.add_exception_handler(RequestValidationError, validation_exception_handler)
app.add_exception_handler(SQLAlchemyError, database_exception_handler)
app.add_exception_handler(Exception, generic_exception_handler)


@app.on_event("startup")
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
    application_info.info({
        'version': '1.0.0',
        'ai_provider': config_settings.AI_PROVIDER,
        'environment': config_settings.ENVIRONMENT
    })

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
        startup_duration_seconds=round(startup_duration, 3)
    )


@app.get("/")
async def root():
    return {
        "message": "Test Me API",
        "version": "1.0.0",
        "docs": "/docs",
        "ai_configured": bool(config_settings.ANTHROPIC_API_KEY or config_settings.OPENAI_API_KEY or config_settings.GEMINI_API_KEY),
    }


@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "ai_provider": config_settings.AI_PROVIDER,
        "ai_configured": bool(config_settings.ANTHROPIC_API_KEY or config_settings.OPENAI_API_KEY or config_settings.GEMINI_API_KEY),
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
app.include_router(questions.router, prefix="/api/questions", tags=["questions"])
app.include_router(status.router, prefix="/api/status", tags=["status"])
app.include_router(decks.router, prefix="/api/decks", tags=["decks"])
app.include_router(tests.router, prefix="/api/tests", tags=["tests (deprecated)"])  # Backward compatibility
app.include_router(progress.router, prefix="/api/progress", tags=["progress"])
app.include_router(settings.router, prefix="/api/settings", tags=["settings"])
app.include_router(tags.router, prefix="/api/tags", tags=["tags"])
app.include_router(search.router, prefix="/api/search", tags=["search"])


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
