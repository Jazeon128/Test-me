from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.db import init_db
from app.api import documents, questions, tests, progress, decks
import os
import logging

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Create upload directory if it doesn't exist
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)

app = FastAPI(
    title="Test Me - Gamified Learning Platform",
    description="Generate multiple-choice tests from documents with spaced repetition",
    version="0.1.0",
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup_event():
    """Initialize database on startup"""
    init_db()
    logger.info("✅ Database initialized")

    # Check API keys
    if settings.ANTHROPIC_API_KEY:
        logger.info("✅ Anthropic API key configured")
    if settings.OPENAI_API_KEY:
        logger.info("✅ OpenAI API key configured")
    if not settings.ANTHROPIC_API_KEY and not settings.OPENAI_API_KEY:
        logger.warning("⚠️  No AI API keys configured! Please set ANTHROPIC_API_KEY or OPENAI_API_KEY in .env")


@app.get("/")
async def root():
    return {
        "message": "Test Me API",
        "version": "0.1.0",
        "docs": "/docs",
        "ai_configured": bool(settings.ANTHROPIC_API_KEY or settings.OPENAI_API_KEY),
    }


@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "ai_provider": settings.AI_PROVIDER,
        "ai_configured": bool(settings.ANTHROPIC_API_KEY or settings.OPENAI_API_KEY),
    }


# Include routers
app.include_router(documents.router, prefix="/api/documents", tags=["documents"])
app.include_router(questions.router, prefix="/api/questions", tags=["questions"])
app.include_router(tests.router, prefix="/api/tests", tags=["tests"])
app.include_router(decks.router, prefix="/api/decks", tags=["decks"])
app.include_router(progress.router, prefix="/api/progress", tags=["progress"])


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
