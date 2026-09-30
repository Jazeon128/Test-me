"""Resolve task settings and construct provider clients without SDK retries."""

from anthropic import Anthropic
from openai import OpenAI
from google import genai
from google.genai import types as genai_types

from ...config import settings
from ...exceptions import AIServiceError
from ...models.settings import Settings
from ..secrets import NAMES, get_secret


DEFAULT_MODELS = {
    "anthropic": "claude-sonnet-5", "openai": "gpt-4o",
    "openrouter": "openrouter/auto", "gemini": "gemini-3.8-flash",
}


def setting(db, key):
    row = db.query(Settings).filter(Settings.key == key).first() if db is not None else None
    return row.value if row else None


def build_client(provider, api_key):
    if provider == "anthropic":
        return Anthropic(api_key=api_key, max_retries=0)
    if provider == "openai":
        return OpenAI(api_key=api_key, max_retries=0)
    if provider == "openrouter":
        return OpenAI(
            api_key=api_key, base_url="https://openrouter.ai/api/v1",
            max_retries=0, timeout=180,
            default_headers={"HTTP-Referer": "https://github.com/Jazeon128/Test-me",
                             "X-OpenRouter-Title": "Test Me"},
        )
    return genai.Client(api_key=api_key, http_options=genai_types.HttpOptions(
        timeout=180_000, retry_options=genai_types.HttpRetryOptions(attempts=1),
    ))


def client_for(task, db):
    provider = (setting(db, f"{task}_provider") or setting(db, "ai_provider")
                or settings.AI_PROVIDER)
    model = setting(db, f"{task}_model") or setting(db, "ai_model") or settings.AI_MODEL
    if provider not in DEFAULT_MODELS:
        raise AIServiceError(f"Unknown AI provider: {provider}", provider=provider)
    api_key = get_secret(provider, db=db, config=settings) if provider in NAMES else ""
    if not api_key:
        raise AIServiceError(f"No API key configured for provider: {provider}", provider=provider)
    return provider, model or DEFAULT_MODELS[provider], build_client(provider, api_key)
