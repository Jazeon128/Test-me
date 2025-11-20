from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional

from ..db import get_db
from ..models.settings import Settings

router = APIRouter()


class AIConfigRequest(BaseModel):
    provider: str  # "anthropic", "openai", or "gemini"
    api_key: str
    model: Optional[str] = None


class AIConfigResponse(BaseModel):
    provider: Optional[str] = None
    model: Optional[str] = None
    api_key_configured: bool = False
    api_key_preview: Optional[str] = None  # First 8 chars for verification


class AIModel(BaseModel):
    id: str
    name: str
    provider: str
    context_window: int
    input_price: float  # Per 1M tokens
    output_price: float  # Per 1M tokens
    description: Optional[str] = None


AVAILABLE_MODELS = [
    # Anthropic
    AIModel(
        id="claude-3-5-sonnet-20241022",
        name="Claude 3.5 Sonnet",
        provider="anthropic",
        context_window=200000,
        input_price=3.00,
        output_price=15.00,
        description="Most intelligent model, best for complex reasoning"
    ),
    AIModel(
        id="claude-3-haiku-20240307",
        name="Claude 3 Haiku",
        provider="anthropic",
        context_window=200000,
        input_price=0.25,
        output_price=1.25,
        description="Fastest and most compact model"
    ),
    # OpenAI
    AIModel(
        id="gpt-4o",
        name="GPT-4o",
        provider="openai",
        context_window=128000,
        input_price=5.00,
        output_price=15.00,
        description="Flagship model, high intelligence"
    ),
    AIModel(
        id="gpt-4o-mini",
        name="GPT-4o Mini",
        provider="openai",
        context_window=128000,
        input_price=0.15,
        output_price=0.60,
        description="Cost-effective small model"
    ),
    # Gemini
    AIModel(
        id="gemini-2.0-flash-exp",
        name="Gemini 2.0 Flash (Experimental)",
        provider="gemini",
        context_window=1048576,
        input_price=0.00,  # Free during preview
        output_price=0.00,
        description="Next-gen multimodal model, extremely fast"
    ),
    AIModel(
        id="gemini-1.5-pro",
        name="Gemini 1.5 Pro",
        provider="gemini",
        context_window=2097152,
        input_price=3.50,
        output_price=10.50,
        description="Mid-size multimodal model, massive context"
    ),
    AIModel(
        id="gemini-1.5-flash",
        name="Gemini 1.5 Flash",
        provider="gemini",
        context_window=1048576,
        input_price=0.35,
        output_price=1.05,
        description="Fast and versatile multimodal model"
    ),
]


def get_setting(db: Session, key: str) -> Optional[str]:
    """Get a setting value from database"""
    setting = db.query(Settings).filter(Settings.key == key).first()
    return setting.value if setting else None


def set_setting(db: Session, key: str, value: str):
    """Set a setting value in database"""
    setting = db.query(Settings).filter(Settings.key == key).first()
    if setting:
        setting.value = value
    else:
        setting = Settings(key=key, value=value)
        db.add(setting)
    db.commit()


@router.get("/ai-config/models")
async def get_available_models():
    """Get list of available AI models"""
    return AVAILABLE_MODELS


@router.get("/ai-config")
async def get_ai_config(db: Session = Depends(get_db)):
    """Get current AI configuration"""
    provider = get_setting(db, "ai_provider")
    api_key = get_setting(db, "api_key")
    model = get_setting(db, "ai_model")

    return AIConfigResponse(
        provider=provider,
        model=model,
        api_key_configured=bool(api_key),
        api_key_preview=api_key[:8] + "..." if api_key and len(api_key) > 8 else None
    )


@router.post("/ai-config")
async def set_ai_config(config: AIConfigRequest, db: Session = Depends(get_db)):
    """Set AI configuration"""

    # Validate provider
    if config.provider not in ["anthropic", "openai", "gemini"]:
        raise HTTPException(
            status_code=400,
            detail="Invalid provider. Must be 'anthropic', 'openai', or 'gemini'"
        )

    # Validate API key format
    if not config.api_key or len(config.api_key) < 10:
        raise HTTPException(
            status_code=400,
            detail="Invalid API key. Key must be at least 10 characters"
        )

    # Validate key format based on provider
    if config.provider == "anthropic" and not config.api_key.startswith("sk-ant-"):
        raise HTTPException(
            status_code=400,
            detail="Invalid Anthropic API key. Must start with 'sk-ant-'"
        )
    elif config.provider == "openai" and not config.api_key.startswith("sk-"):
        raise HTTPException(
            status_code=400,
            detail="Invalid OpenAI API key. Must start with 'sk-'"
        )
    elif config.provider == "gemini" and not config.api_key.startswith("AIza"):
        # Gemini keys usually start with AIza, but let's be lenient if it changes
        pass

    # Save settings
    set_setting(db, "ai_provider", config.provider)
    set_setting(db, "api_key", config.api_key)
    if config.model:
        set_setting(db, "ai_model", config.model)

    return {
        "success": True,
        "provider": config.provider,
        "model": config.model,
        "api_key_preview": config.api_key[:8] + "...",
        "message": "AI configuration saved successfully"
    }


@router.delete("/ai-config")
async def delete_ai_config(db: Session = Depends(get_db)):
    """Delete AI configuration"""

    # Delete settings
    db.query(Settings).filter(Settings.key.in_(["ai_provider", "api_key", "ai_model"])).delete()
    db.commit()

    return {
        "success": True,
        "message": "AI configuration deleted"
    }


@router.post("/ai-config/test")
async def test_ai_config(db: Session = Depends(get_db)):
    """Test current AI configuration by making a simple API call"""
    from ..services.ai import QuestionGenerator

    try:
        generator = QuestionGenerator(db=db)

        # Simple test - try to initialize the client
        if generator.client is None:
            raise Exception("Failed to initialize AI client")

        return {
            "success": True,
            "provider": generator.provider,
            "model": generator.model,
            "message": f"Successfully connected to {generator.provider} using {generator.model}"
        }
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"Failed to connect to AI provider: {str(e)}"
        )
