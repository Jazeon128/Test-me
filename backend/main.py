from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings as config_settings
from app.db import init_db
from app.api import documents, questions, progress, decks, settings
import os
import logging

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Create upload directory if it doesn't exist
os.makedirs(config_settings.UPLOAD_DIR, exist_ok=True)

app = FastAPI(
    title="FlashLearn - AI-Powered Flashcard Platform",
    description="Upload documents, generate flashcards, and learn with spaced repetition",
    version="1.0.0",
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=config_settings.CORS_ORIGINS,
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
    if config_settings.ANTHROPIC_API_KEY:
        logger.info("✅ Anthropic API key configured")
    if config_settings.OPENAI_API_KEY:
        logger.info("✅ OpenAI API key configured")
    if config_settings.GEMINI_API_KEY:
        logger.info("✅ Gemini API key configured")
    if not config_settings.ANTHROPIC_API_KEY and not config_settings.OPENAI_API_KEY and not config_settings.GEMINI_API_KEY:
        logger.warning("⚠️  No AI API keys configured! Please set ANTHROPIC_API_KEY, OPENAI_API_KEY, or GEMINI_API_KEY in .env")


@app.get("/")
async def root():
    return {
        "message": "FlashLearn API",
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


# Include routers
app.include_router(documents.router, prefix="/api/documents", tags=["documents"])
app.include_router(questions.router, prefix="/api/questions", tags=["questions"])

app.include_router(decks.router, prefix="/api/decks", tags=["decks"])
app.include_router(progress.router, prefix="/api/progress", tags=["progress"])
app.include_router(settings.router, prefix="/api/settings", tags=["settings"])


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
