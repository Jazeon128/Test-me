"""One retry policy shared by all providers."""

import random
import re
import time
from dataclasses import dataclass

LABELS = {"anthropic": "Anthropic", "openai": "OpenAI", "gemini": "Gemini",
          "openrouter": "OpenRouter"}


@dataclass
class RetryState:
    attempts: int = 0
    quota_exhausted: bool = False


def status_of(error):
    return getattr(error, "status_code", None) or getattr(error, "code", None)


def quota_exhausted(error, provider_label):
    status = status_of(error)
    text = str(error).lower()
    if status == 429 and "perday" in text:
        return True
    if provider_label != "OpenRouter":
        return False
    if status == 402:
        return True
    return (status == 429 and any(word in text for word in ("key", "credit"))
            and any(word in text for word in ("exhaust", "insufficient", "limit reached",
                                              "limit exceeded")))


def retry_delay(error, attempt):
    response = getattr(error, "response", None)
    headers = getattr(response, "headers", None) or getattr(error, "headers", {})
    header = headers.get("Retry-After") or headers.get("retry-after")
    try:
        seconds = float(header)
        if seconds >= 0:
            return min(60.0, seconds)
    except (ValueError, TypeError):
        pass
    return gemini_retry_delay(error, attempt)


def gemini_retry_delay(error, attempt):
    if status_of(error) == 429:
        text = f"{error} {getattr(error, 'details', '')}"
        match = re.search(r"retryDelay['\"]?\s*[:=]\s*['\"]?(\d+(?:\.\d+)?)s", text)
        if match:
            return min(60.0, float(match.group(1)))
    return min(20.0, 2 ** attempt + random.uniform(0, 1))


def _call_with_retry(call, provider_label, *, state=None, on_step=None):
    state = state if state is not None else RetryState()
    for attempt in range(1, 5):
        state.attempts = attempt
        try:
            return call()
        except Exception as error:
            state.quota_exhausted = quota_exhausted(error, provider_label)
            if state.quota_exhausted or status_of(error) not in {429, 500, 502, 503, 504}:
                raise
            if attempt == 4:
                raise
            delay = retry_delay(error, attempt)
            if on_step:
                if status_of(error) == 429:
                    on_step(f"{provider_label} rate limit, retrying in {delay:g} s (attempt {attempt + 1} of 4)")
                else:
                    on_step(f"{provider_label} is busy, retrying (attempt {attempt + 1} of 4)")
            time.sleep(delay)
