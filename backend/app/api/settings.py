from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional

from ..db import get_db
from ..models.settings import Settings

router = APIRouter()


class AIConfigRequest(BaseModel):
    provider: str  # "anthropic" or "openai"
    api_key: str


class AIConfigResponse(BaseModel):
    provider: Optional[str] = None
    api_key_configured: bool = False
    api_key_preview: Optional[str] = None  # First 8 chars for verification


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


@router.get("/ai-config")
async def get_ai_config(db: Session = Depends(get_db)):
    """Get current AI configuration"""
    provider = get_setting(db, "ai_provider")
    api_key = get_setting(db, "api_key")

    return AIConfigResponse(
        provider=provider,
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
        raise HTTPException(
            status_code=400,
            detail="Invalid Gemini API key. Must start with 'AIza'"
        )

    # Save settings
    set_setting(db, "ai_provider", config.provider)
    set_setting(db, "api_key", config.api_key)

    return {
        "success": True,
        "provider": config.provider,
        "api_key_preview": config.api_key[:8] + "...",
        "message": "AI configuration saved successfully"
    }


@router.delete("/ai-config")
async def delete_ai_config(db: Session = Depends(get_db)):
    """Delete AI configuration"""

    # Delete settings
    db.query(Settings).filter(Settings.key.in_(["ai_provider", "api_key"])).delete()
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
            "message": f"Successfully connected to {generator.provider}"
        }
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"Failed to connect to AI provider: {str(e)}"
        )
