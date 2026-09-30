"""Public OpenRouter catalog with a one-hour in-memory cache."""

import time
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation

import requests
from fastapi import HTTPException

BASE_URL = "https://openrouter.ai/api/v1"
CACHE_SECONDS = 3600
_cache = None
_cached_at = 0.0


def price(value, multiplier=1):
    try:
        number = Decimal(str(value)) * multiplier
        # Routers such as openrouter/auto report -1: the price depends on the
        # model they pick, so it is unknown, not negative.
        if not number.is_finite() or number < 0:
            return None
        text = format(number, "f")
        return text.rstrip("0").rstrip(".") if "." in text else text
    except (InvalidOperation, ValueError, TypeError):
        return None


def model_info(model):
    pricing = model.get("pricing") or {}
    prompt = price(pricing.get("prompt"), 1_000_000)
    completion = price(pricing.get("completion"), 1_000_000)
    return {
        "id": model["id"], "name": model.get("name"),
        "context_length": model.get("context_length"),
        "max_completion_tokens": (model.get("top_provider") or {}).get("max_completion_tokens"),
        "prompt_per_million": prompt, "completion_per_million": completion,
        "request_price": price(pricing.get("request")),
        "free": prompt is not None and completion is not None
        and Decimal(prompt) == 0 and Decimal(completion) == 0,
        "supported_parameters": model.get("supported_parameters") or [],
        "input_modalities": (model.get("architecture") or {}).get("input_modalities") or [],
    }


def writes_text(model):
    """Question generation needs text out. Music and image models are left out."""
    outputs = (model.get("architecture") or {}).get("output_modalities")
    return not outputs or "text" in outputs


def get_models(refresh=False):
    global _cache, _cached_at
    if not refresh and _cache is not None and time.monotonic() - _cached_at < CACHE_SECONDS:
        return _cache
    try:
        response = requests.get(f"{BASE_URL}/models", timeout=20)
        response.raise_for_status()
        models = [model_info(model) for model in response.json()["data"] if writes_text(model)]
    except (requests.RequestException, ValueError, KeyError, TypeError):
        if _cache is not None:
            return {**_cache, "stale": True}
        raise HTTPException(status_code=502, detail="Could not fetch the OpenRouter model catalog.") from None
    _cache = {"fetched_at": datetime.now(timezone.utc).isoformat(), "models": models}
    _cached_at = time.monotonic()
    return _cache


def get_key_info(api_key):
    try:
        response = requests.get(
            f"{BASE_URL}/key", headers={"Authorization": f"Bearer {api_key}"}, timeout=20,
        )
        response.raise_for_status()
        data = response.json()["data"]
    except (requests.RequestException, ValueError, KeyError, TypeError):
        raise HTTPException(status_code=502, detail="Could not fetch OpenRouter key usage.") from None
    return {name: data.get(name) for name in ("limit", "limit_remaining", "usage", "is_free_tier")}
