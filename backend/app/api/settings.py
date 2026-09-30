import time

from fastapi import APIRouter, Depends, HTTPException
from fastapi.concurrency import run_in_threadpool
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional

from ..db import get_db
from ..models.settings import Settings
from ..services import jev
from ..services.typesafe_key import SETTING_KEY, typesafe_key, typesafe_key_source

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
    is_custom_model: bool = False  # True if model is not in AVAILABLE_MODELS


class AIModel(BaseModel):
    id: str
    name: str
    provider: str
    context_window: int
    input_price: float  # Per 1M tokens
    output_price: float  # Per 1M tokens
    description: Optional[str] = None


# Last updated: 2026-09-26
# To update: Call POST /api/settings/ai-config/models/refresh or manually update this list
AVAILABLE_MODELS = [
    # Anthropic - https://www.anthropic.com/api
    AIModel(
        id="claude-sonnet-5",
        name="Claude Sonnet 5",
        provider="anthropic",
        context_window=1000000,
        input_price=2.00,
        output_price=10.00,
        description="The default. Strong reasoning at a moderate price",
    ),
    AIModel(
        id="claude-opus-5",
        name="Claude Opus 5",
        provider="anthropic",
        context_window=1000000,
        input_price=5.00,
        output_price=25.00,
        description="Most capable, for the hardest material",
    ),
    AIModel(
        id="claude-haiku-4-5",
        name="Claude Haiku 4.5",
        provider="anthropic",
        context_window=200000,
        input_price=1.00,
        output_price=5.00,
        description="Fastest and cheapest, for straightforward material",
    ),
    # Kept so a saved configuration naming an older model still resolves.
    AIModel(
        id="claude-3-5-sonnet-20241022",
        name="Claude 3.5 Sonnet",
        provider="anthropic",
        context_window=200000,
        input_price=3.00,
        output_price=15.00,
        description="Superseded by Claude Sonnet 5",
    ),
    AIModel(
        id="claude-3-5-haiku-20241022",
        name="Claude 3.5 Haiku",
        provider="anthropic",
        context_window=200000,
        input_price=0.80,
        output_price=4.00,
        description="Fastest model with improved intelligence",
    ),
    AIModel(
        id="claude-3-haiku-20240307",
        name="Claude 3 Haiku",
        provider="anthropic",
        context_window=200000,
        input_price=0.25,
        output_price=1.25,
        description="Legacy fast model",
    ),
    # OpenAI - https://openai.com/api/pricing/
    AIModel(
        id="gpt-4o",
        name="GPT-4o",
        provider="openai",
        context_window=128000,
        input_price=2.50,
        output_price=10.00,
        description="Flagship model, high intelligence",
    ),
    AIModel(
        id="gpt-4o-mini",
        name="GPT-4o Mini",
        provider="openai",
        context_window=128000,
        input_price=0.15,
        output_price=0.60,
        description="Cost-effective small model",
    ),
    AIModel(
        id="gpt-4-turbo",
        name="GPT-4 Turbo",
        provider="openai",
        context_window=128000,
        input_price=10.00,
        output_price=30.00,
        description="Previous generation flagship",
    ),
    # Google Gemini - https://ai.google.dev/gemini-api/docs/pricing
    # Prices are the paid tier. All three below are also available on Google's
    # free tier, where input and output are free of charge and your content is
    # used to improve Google's products.
    AIModel(
        id="gemini-3.8-flash",
        name="Gemini 3.8 Flash",
        provider="gemini",
        context_window=1048576,
        input_price=0.75,
        output_price=3.75,
        description="The default. Free tier available",
    ),
    AIModel(
        id="gemini-3.5-flash-lite",
        name="Gemini 3.5 Flash-Lite",
        provider="gemini",
        context_window=1048576,
        input_price=0.30,
        output_price=2.50,
        description="Fastest and cheapest, for routine material. Free tier available",
    ),
    AIModel(
        id="gemini-3.1-pro-preview",
        name="Gemini 3.1 Pro (preview)",
        provider="gemini",
        context_window=1048576,
        input_price=0.00,
        output_price=0.00,
        description="Preview: stricter rate limits, and may start billing",
    ),
    # Google now limits the 2.5 models to projects that already used them, so
    # these are kept only so an existing saved configuration still resolves.
    AIModel(
        id="gemini-3-pro-preview",
        name="Gemini 3 Pro Preview",
        provider="gemini",
        context_window=1048576,
        input_price=0.00,  # Preview pricing TBD
        output_price=0.00,
        description="Superseded by Gemini 3.1 Pro",
    ),
    AIModel(
        id="gemini-2.5-flash",
        name="Gemini 2.5 Flash",
        provider="gemini",
        context_window=1048576,
        input_price=0.00,  # Pricing TBD
        output_price=0.00,
        description="Legacy: restricted to projects that already used it",
    ),
    AIModel(
        id="gemini-2.5-flash-lite",
        name="Gemini 2.5 Flash-Lite",
        provider="gemini",
        context_window=1048576,
        input_price=0.00,  # Pricing TBD
        output_price=0.00,
        description="Legacy: restricted to projects that already used it",
    ),
    AIModel(
        id="gemini-2.5-pro",
        name="Gemini 2.5 Pro",
        provider="gemini",
        context_window=1048576,
        input_price=0.00,  # Pricing TBD
        output_price=0.00,
        description="Legacy: restricted to projects that already used it",
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


class TypeSafeKeyRequest(BaseModel):
    api_key: str


@router.get("/typesafe")
async def get_typesafe_config(db: Session = Depends(get_db)):
    api_key = typesafe_key(db)
    return {
        "configured": bool(api_key),
        "source": typesafe_key_source(db),
        "preview": "…" + api_key[-4:] if api_key else None,
    }


@router.put("/typesafe")
async def save_typesafe_config(config: TypeSafeKeyRequest, db: Session = Depends(get_db)):
    api_key = config.api_key.strip()
    if len(api_key) < 10:
        raise HTTPException(
            status_code=400,
            detail="Invalid TypeSafe API key. Key must be at least 10 characters",
        )
    set_setting(db, SETTING_KEY, api_key)
    return {**await get_typesafe_config(db), "message": "TypeSafe key saved"}


@router.delete("/typesafe")
async def delete_typesafe_config(db: Session = Depends(get_db)):
    db.query(Settings).filter(Settings.key == SETTING_KEY).delete()
    db.commit()
    return {**await get_typesafe_config(db), "message": "TypeSafe key removed"}


@router.post("/typesafe/test")
async def test_typesafe_config(db: Session = Depends(get_db)):
    api_key = typesafe_key(db)
    if not api_key:
        raise HTTPException(status_code=400, detail="No TypeSafe API key is configured.")
    started = time.monotonic()
    try:
        await run_in_threadpool(
            jev.ask,
            state={"text": "The sky is blue."},
            questions={
                "connection_check": {
                    "type": "noul",
                    "instructions": "Does `text` describe a colour?",
                    "criteria": {
                        "true": "The text describes a colour",
                        "false": "The text does not describe a colour",
                    },
                },
            },
            api_key=api_key,
            timeout=20.0,
            label="settings_test",
        )
    except jev.JevUnavailable as error:
        response = getattr(error.__cause__, "response", None)
        status = getattr(response, "status_code", None)
        if status in (401, 403):
            message = "TypeSafe rejected the API key. Check it was copied in full and is still active."
        elif status == 429:
            message = "The key works, but TypeSafe refused the call: rate limit or quota reached."
        elif status is not None:
            message = f"TypeSafe returned HTTP {status}."
        else:
            reason = str(error).replace(api_key, "[redacted]")[:200]
            message = f"Could not reach TypeSafe: {reason}"
        raise HTTPException(status_code=400, detail=message) from error
    latency_ms = int((time.monotonic() - started) * 1000)
    return {
        "success": True,
        "latency_ms": latency_ms,
        "message": f"Connected to TypeSafe ({latency_ms} ms).",
    }


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

    # Check if model is custom (not in predefined list)
    is_custom = False
    if model:
        is_custom = model not in [m.id for m in AVAILABLE_MODELS]

    return AIConfigResponse(
        provider=provider,
        model=model,
        api_key_configured=bool(api_key),
        api_key_preview=api_key[:8] + "..." if api_key and len(api_key) > 8 else None,
        is_custom_model=is_custom,
    )


@router.post("/ai-config")
async def set_ai_config(config: AIConfigRequest, db: Session = Depends(get_db)):
    """Set AI configuration"""

    # Validate provider
    if config.provider not in ["anthropic", "openai", "gemini"]:
        raise HTTPException(
            status_code=400, detail="Invalid provider. Must be 'anthropic', 'openai', or 'gemini'"
        )

    # Validate API key format
    if not config.api_key or len(config.api_key) < 10:
        raise HTTPException(
            status_code=400, detail="Invalid API key. Key must be at least 10 characters"
        )

    # Validate key format based on provider
    if config.provider == "anthropic" and not config.api_key.startswith("sk-ant-"):
        raise HTTPException(
            status_code=400, detail="Invalid Anthropic API key. Must start with 'sk-ant-'"
        )
    elif config.provider == "openai" and not config.api_key.startswith("sk-"):
        raise HTTPException(status_code=400, detail="Invalid OpenAI API key. Must start with 'sk-'")
    # Gemini keys are deliberately not prefix-checked. Google has issued at
    # least two formats (AIza..., AQ....), so a prefix rule would reject valid
    # keys the next time the format changes.

    # Validate model name (accept any non-empty string)
    if config.model:
        model_trimmed = config.model.strip()
        if not model_trimmed:
            raise HTTPException(
                status_code=400, detail="Model name cannot be empty or whitespace only"
            )
        # Store the trimmed model name exactly as provided
        set_setting(db, "ai_model", model_trimmed)

    # Save settings
    set_setting(db, "ai_provider", config.provider)
    set_setting(db, "api_key", config.api_key)

    return {
        "success": True,
        "provider": config.provider,
        "model": config.model.strip() if config.model else None,
        "api_key_preview": config.api_key[:8] + "...",
        "message": "AI configuration saved successfully",
    }


@router.delete("/ai-config")
async def delete_ai_config(db: Session = Depends(get_db)):
    """Delete AI configuration"""

    # Delete settings
    db.query(Settings).filter(Settings.key.in_(["ai_provider", "api_key", "ai_model"])).delete()
    db.commit()

    return {"success": True, "message": "AI configuration deleted"}


#: A connection test sends one tiny prompt. It must be cheap and must not hang.
TEST_PROMPT = "Reply with the single word OK."
TEST_MAX_TOKENS = 16
TEST_TIMEOUT_SECONDS = 20.0
MAX_ERROR_CHARS = 200

#: How each provider says the key is bad, seen in the error text.
INVALID_KEY_MARKERS = (
    "API_KEY_INVALID",  # Google, with HTTP 400
    "API key not valid",  # Google
    "invalid x-api-key",  # Anthropic
    "Incorrect API key",  # OpenAI
)


def _status_of(error: Exception) -> Optional[int]:
    """The HTTP status of a provider error, whichever SDK raised it.

    Anthropic and OpenAI errors carry status_code. google-genai errors carry code.
    """
    for attribute in ("status_code", "code"):
        value = getattr(error, attribute, None)
        if isinstance(value, int):
            return value
    return None


def describe_connection_failure(provider: str, model: str, error: Exception) -> str:
    """Turn a provider error into something the user can act on."""
    status = _status_of(error)
    text = str(error)
    # Google answers a bad key with 400 and API_KEY_INVALID, not 401, so the
    # body is checked as well as the status.
    if status in (401, 403) or any(marker in text for marker in INVALID_KEY_MARKERS):
        return f"{provider} rejected the API key. Check it was copied in full and is still active."
    if status == 404:
        return f"{provider} does not recognise the model {model}. Choose another model."
    if status == 429:
        return f"The key works, but {provider} refused the call: rate limit or quota reached."
    if status in (500, 502, 503, 504):
        return f"The key works, but {provider} is overloaded or returned an error ({status}). Try again shortly."
    if status is not None:
        return f"{provider} returned HTTP {status}: {text[:MAX_ERROR_CHARS]}"
    return f"Could not reach {provider}: {text[:MAX_ERROR_CHARS]}"


@router.post("/ai-config/test")
async def test_ai_config(db: Session = Depends(get_db)):
    """Test the saved AI configuration by making one real, minimal call.

    Building a client proves nothing, since clients accept any string as a key.
    Only a reply from the provider shows the key, the model and the network
    path all work.
    """
    from ..services.ai import QuestionGenerator, completion

    try:
        generator = QuestionGenerator(db=db)
    except Exception as error:
        raise HTTPException(status_code=400, detail=f"AI provider is not configured: {error}")

    started = time.monotonic()
    try:
        await run_in_threadpool(
            completion.complete,
            generator.provider,
            generator.model,
            generator.client,
            TEST_PROMPT,
            max_tokens=TEST_MAX_TOKENS,
            timeout=TEST_TIMEOUT_SECONDS,
        )
    except Exception as error:
        raise HTTPException(
            status_code=400,
            detail=describe_connection_failure(generator.provider, generator.model, error),
        )

    latency_ms = int((time.monotonic() - started) * 1000)
    return {
        "success": True,
        "provider": generator.provider,
        "model": generator.model,
        "latency_ms": latency_ms,
        "message": f"Connected to {generator.provider} using {generator.model} ({latency_ms} ms).",
    }


@router.post("/ai-config/models/refresh")
async def refresh_models():
    """
    Manually refresh the AI models list.

    This endpoint allows administrators to trigger a manual update of the available
    AI models. Currently, this returns instructions for updating the models, as
    providers don't offer public APIs for model discovery.

    To update models:
    1. Check provider documentation:
       - Anthropic: https://www.anthropic.com/api
       - OpenAI: https://openai.com/api/pricing/
       - Google Gemini: https://ai.google.dev/pricing
    2. Update the AVAILABLE_MODELS list in backend/app/api/settings.py
    3. Update the last_updated date in the comment above AVAILABLE_MODELS
    4. Restart the backend server
    """
    return {
        "success": True,
        "message": "Model list refresh instructions provided",
        "current_models_count": len(AVAILABLE_MODELS),
        "last_updated": "2025-12-05",
        "models_by_provider": {
            "anthropic": len([m for m in AVAILABLE_MODELS if m.provider == "anthropic"]),
            "openai": len([m for m in AVAILABLE_MODELS if m.provider == "openai"]),
            "gemini": len([m for m in AVAILABLE_MODELS if m.provider == "gemini"]),
        },
        "instructions": {
            "step_1": "Check provider documentation for latest models",
            "step_2": "Update AVAILABLE_MODELS in backend/app/api/settings.py",
            "step_3": "Update last_updated comment",
            "step_4": "Restart backend server",
            "documentation_links": {
                "anthropic": "https://www.anthropic.com/api",
                "openai": "https://openai.com/api/pricing/",
                "gemini": "https://ai.google.dev/pricing",
            },
        },
    }


@router.get("/ai-config/models/info")
async def get_models_info():
    """Get metadata about the current models list"""
    return {
        "last_updated": "2025-12-05",
        "total_models": len(AVAILABLE_MODELS),
        "models_by_provider": {
            "anthropic": [m.model_dump() for m in AVAILABLE_MODELS if m.provider == "anthropic"],
            "openai": [m.model_dump() for m in AVAILABLE_MODELS if m.provider == "openai"],
            "gemini": [m.model_dump() for m in AVAILABLE_MODELS if m.provider == "gemini"],
        },
        "provider_counts": {
            "anthropic": len([m for m in AVAILABLE_MODELS if m.provider == "anthropic"]),
            "openai": len([m for m in AVAILABLE_MODELS if m.provider == "openai"]),
            "gemini": len([m for m in AVAILABLE_MODELS if m.provider == "gemini"]),
        },
    }
