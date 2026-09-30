"""One text completion, against whichever provider the user configured.

QuestionGenerator already resolves the provider, model and key from the settings
table. This takes the client it built and makes a single call, so a second
feature does not need a second set of credentials or a second client.
"""

import time
from dataclasses import dataclass
from typing import Any, Optional

from ...exceptions import AIServiceError
from .retry import LABELS, RetryState, _call_with_retry
from .ledger import field, record_call


@dataclass
class Completion:
    text: str
    input_tokens: Optional[int] = None
    output_tokens: Optional[int] = None
    cost_usd: Optional[float] = None
    actual_model: Optional[str] = None
    upstream_provider: Optional[str] = None
    raw_response: Any = None


def _complete_once(
    provider: str,
    model: str,
    client: Any,
    prompt: str,
    max_tokens: int = 8192,
    temperature: float = 0.2,
    timeout: float = 180.0,
) -> Completion:
    """Send one prompt and return the text.

    The default temperature is lower than question generation uses: this is
    called for structured JSON, where variety is not wanted.

    The timeout matters: without one a provider that cannot complete a TLS
    handshake retries indefinitely, and the job it belongs to sits reporting
    progress forever instead of failing.
    """
    if provider == "anthropic":
        response = client.messages.create(
            model=model,
            timeout=timeout,
            max_tokens=max_tokens,
            messages=[{"role": "user", "content": prompt}],
        )
        usage = getattr(response, "usage", None)
        return Completion(
            raw_response=response,
            actual_model=field(response, "model", model),
            upstream_provider=field(response, "provider"),
            cost_usd=field(usage, "cost") if provider == "openrouter" else None,
            text=response.content[0].text,
            input_tokens=getattr(usage, "input_tokens", None),
            output_tokens=getattr(usage, "output_tokens", None),
        )

    if provider in {"openai", "openrouter"}:
        response = client.chat.completions.create(
            model=model,
            timeout=timeout,
            messages=[{"role": "user", "content": prompt}],
            temperature=temperature,
            max_tokens=max_tokens,
        )
        usage = getattr(response, "usage", None)
        return Completion(
            raw_response=response,
            actual_model=field(response, "model", model),
            upstream_provider=field(response, "provider"),
            cost_usd=field(usage, "cost") if provider == "openrouter" else None,
            text=response.choices[0].message.content,
            input_tokens=getattr(usage, "prompt_tokens", None),
            output_tokens=getattr(usage, "completion_tokens", None),
        )

    if provider == "gemini":
        from google.genai import types

        response = client.models.generate_content(
            model=model,
            contents=prompt,
            config=types.GenerateContentConfig(
                max_output_tokens=max_tokens,
                temperature=temperature,
                # google-genai takes the timeout in milliseconds. Fields left
                # unset here, such as the client's retry policy, still apply.
                http_options=types.HttpOptions(timeout=int(timeout * 1000)),
                # No tools are sent, so function calling only adds a warning.
                automatic_function_calling=types.AutomaticFunctionCallingConfig(disable=True),
            ),
        )
        usage = getattr(response, "usage_metadata", None)
        return Completion(
            raw_response=response,
            actual_model=field(response, "model", model),
            upstream_provider=field(response, "provider"),
            cost_usd=field(usage, "cost") if provider == "openrouter" else None,
            text=response.text,
            input_tokens=getattr(usage, "prompt_token_count", None),
            output_tokens=getattr(usage, "candidates_token_count", None),
        )

    raise AIServiceError(
        message=f"Unknown AI provider: {provider}",
        provider=provider,
        details={"supported_providers": ["anthropic", "openai", "gemini", "openrouter"]},
    )


def complete(provider, model, client, prompt, max_tokens=8192, temperature=0.2,
             timeout=180.0, *, db=None, task="canvas", job_id=None, on_step=None):
    """Retry one logical completion and record it without exposing credentials."""
    state = RetryState()
    started = time.monotonic()
    result = None
    error = None
    try:
        result = _call_with_retry(
            lambda: _complete_once(provider, model, client, prompt,
                                   max_tokens, temperature, timeout),
            LABELS.get(provider, provider), state=state, on_step=on_step,
        )
        return result
    except Exception as exc:
        error = exc
        raise
    finally:
        record_call(
            db=db, task=task, provider=provider, model=model, started=started,
            attempts=state.attempts,
            response=result.raw_response if result is not None else None,
            error=error, job_id=job_id,
        )
