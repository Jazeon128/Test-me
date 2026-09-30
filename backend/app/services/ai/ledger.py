"""Best-effort ledger writes isolated from the caller's transaction."""

import time
from decimal import Decimal, InvalidOperation

from sqlalchemy.orm import Session

from ...db.database import SessionLocal
from ...models.llm_call import LLMCall
from ...utils.metrics import estimate_cost


def field(obj, name, default=None):
    return obj.get(name, default) if isinstance(obj, dict) else getattr(obj, name, default)


def _number(value):
    if isinstance(value, (str, int, float, Decimal)):
        try:
            result = Decimal(str(value))
            return result if result.is_finite() else None
        except InvalidOperation:
            pass
    return None


def usage_of(provider, response):
    if provider == "gemini":
        usage = field(response, "usage_metadata")
        names = ("prompt_token_count", "candidates_token_count")
    else:
        usage = field(response, "usage")
        names = (("input_tokens", "output_tokens") if provider == "anthropic"
                 else ("prompt_tokens", "completion_tokens"))
    return tuple(field(usage, name) for name in names)


def cost_of(provider, model, response, input_tokens, output_tokens):
    if provider == "openrouter":
        cost = _number(field(field(response, "usage"), "cost"))
        return cost, "provider_reported" if cost is not None else "unknown"
    if not isinstance(input_tokens, int) or not isinstance(output_tokens, int):
        return None, "unknown"
    cost = estimate_cost(provider, model, input_tokens, output_tokens)
    return _number(cost), "estimated" if cost is not None else "unknown"


def _write(db, values):
    session = Session(bind=db.get_bind()) if db is not None else SessionLocal()
    with session:
        session.add(LLMCall(**values))
        session.commit()


def record_call(*, db=None, task, provider, model, started, attempts,
                response=None, error=None, job_id=None):
    """Failure to extract or persist telemetry must never affect generation."""
    try:
        input_tokens, output_tokens = usage_of(provider, response)
        cost, source = cost_of(provider, model, response, input_tokens, output_tokens)
        actual_model = field(response, "model")
        upstream = field(response, "provider")
        response_id = field(response, "id")
        _write(db, dict(
            task=task, provider=provider, requested_model=model,
            actual_model=actual_model if isinstance(actual_model, str) else model,
            upstream_provider=upstream if isinstance(upstream, str) else None,
            input_tokens=input_tokens if isinstance(input_tokens, int) else 0,
            output_tokens=output_tokens if isinstance(output_tokens, int) else 0,
            cost_usd=cost, cost_source=source,
            latency_ms=int((time.monotonic() - started) * 1000),
            attempts=attempts, status="error" if error else "ok",
            error_type=type(error).__name__ if error else None,
            job_id=job_id, response_id=response_id if isinstance(response_id, str) else None,
        ))
    except Exception:
        # No error text is logged: it can contain request or credential data.
        pass
