"""
Prometheus metrics collection for Test Me platform

This module defines and manages all Prometheus metrics for monitoring
application performance, AI usage, and system health.
"""

from prometheus_client import Counter, Histogram, Gauge, Info
from typing import Optional

# ============================================================================
# Question Generation Metrics
# ============================================================================

question_generation_duration = Histogram(
    "question_generation_duration_seconds",
    "Time spent generating questions",
    ["provider", "difficulty"],
    buckets=(1, 5, 10, 20, 30, 45, 60, 90, 120, 180, 300),
)

question_generation_total = Counter(
    "question_generation_total",
    "Total number of question generation requests",
    ["provider", "difficulty", "status"],
)

questions_generated_count = Counter(
    "questions_generated_count", "Total number of questions generated", ["provider", "difficulty"]
)

# ============================================================================
# AI API Metrics
# ============================================================================

ai_api_calls_total = Counter(
    "ai_api_calls_total", "Total number of AI API calls", ["provider", "model", "status"]
)

ai_api_duration = Histogram(
    "ai_api_duration_seconds",
    "Duration of AI API calls",
    ["provider", "model"],
    buckets=(0.5, 1, 2, 5, 10, 15, 20, 30, 45, 60),
)

ai_tokens_used = Counter(
    "ai_tokens_used_total", "Total number of tokens used", ["provider", "model", "token_type"]
)

ai_estimated_cost = Counter(
    "ai_estimated_cost_usd", "Estimated cost of AI API usage in USD", ["provider", "model"]
)

# ============================================================================
# API Request Metrics
# ============================================================================

api_requests_total = Counter(
    "api_requests_total", "Total number of API requests", ["method", "endpoint", "status"]
)

api_request_duration = Histogram(
    "api_request_duration_seconds",
    "Duration of API requests",
    ["method", "endpoint"],
    buckets=(0.01, 0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10),
)

# ============================================================================
# Database Metrics
# ============================================================================

db_query_duration = Histogram(
    "db_query_duration_seconds",
    "Duration of database queries",
    ["operation"],
    buckets=(0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1),
)

db_operations_total = Counter(
    "db_operations_total", "Total number of database operations", ["operation", "status"]
)

# ============================================================================
# Document Processing Metrics
# ============================================================================

document_uploads_total = Counter(
    "document_uploads_total", "Total number of document uploads", ["file_type", "status"]
)

document_parsing_duration = Histogram(
    "document_parsing_duration_seconds",
    "Duration of document parsing",
    ["file_type"],
    buckets=(0.1, 0.5, 1, 2, 5, 10, 20, 30),
)

document_size_bytes = Histogram(
    "document_size_bytes",
    "Size of uploaded documents in bytes",
    ["file_type"],
    buckets=(1024, 10240, 102400, 1024000, 10240000, 52428800),
)

# ============================================================================
# User Progress Metrics
# ============================================================================

answers_submitted_total = Counter(
    "answers_submitted_total", "Total number of answers submitted", ["result", "difficulty"]
)

review_sessions_total = Counter(
    "review_sessions_total", "Total number of review sessions started", ["session_type"]
)

# ============================================================================
# Error Metrics
# ============================================================================

errors_total = Counter("errors_total", "Total number of errors", ["error_type", "endpoint"])

# ============================================================================
# System Metrics
# ============================================================================

active_users = Gauge("active_users", "Number of currently active users")

application_info = Info("application", "Application version and configuration")


# ============================================================================
# Helper Functions
# ============================================================================


def track_question_generation(
    provider: str, difficulty: str, duration: float, num_questions: int, success: bool
) -> None:
    """
    Track question generation metrics

    Args:
        provider: AI provider name (anthropic, openai, gemini)
        difficulty: Question difficulty level
        duration: Time taken in seconds
        num_questions: Number of questions generated
        success: Whether generation was successful
    """
    status = "success" if success else "failure"

    question_generation_duration.labels(provider=provider, difficulty=difficulty).observe(duration)

    question_generation_total.labels(provider=provider, difficulty=difficulty, status=status).inc()

    if success:
        questions_generated_count.labels(provider=provider, difficulty=difficulty).inc(
            num_questions
        )


def track_ai_api_call(
    provider: str,
    model: str,
    duration: float,
    success: bool,
    input_tokens: Optional[int] = None,
    output_tokens: Optional[int] = None,
    estimated_cost: Optional[float] = None,
) -> None:
    """
    Track AI API call metrics

    Args:
        provider: AI provider name
        model: Model name
        duration: API call duration in seconds
        success: Whether the call was successful
        input_tokens: Number of input tokens (if available)
        output_tokens: Number of output tokens (if available)
        estimated_cost: Estimated cost in USD (if available)
    """
    status = "success" if success else "failure"

    ai_api_calls_total.labels(provider=provider, model=model, status=status).inc()

    ai_api_duration.labels(provider=provider, model=model).observe(duration)

    if input_tokens is not None:
        ai_tokens_used.labels(provider=provider, model=model, token_type="input").inc(input_tokens)

    if output_tokens is not None:
        ai_tokens_used.labels(provider=provider, model=model, token_type="output").inc(
            output_tokens
        )

    if estimated_cost is not None:
        ai_estimated_cost.labels(provider=provider, model=model).inc(estimated_cost)


def estimate_cost(provider: str, model: str, input_tokens: int, output_tokens: int) -> Optional[float]:
    """
    Estimate the cost of an AI API call based on token usage

    Pricing as of December 2024 (updated 2025-12-05):
    - Claude 3.5 Sonnet: $3/MTok input, $15/MTok output
    - Claude 3.5 Haiku: $0.80/MTok input, $4/MTok output
    - GPT-4o: $2.50/MTok input, $10/MTok output
    - Gemini 3 Pro Preview: Free during preview
    - Gemini 2.5 Flash: Free during preview
    - Gemini 2.5 Flash-Lite: Free during preview
    - Gemini 2.5 Pro: Free during preview

    Args:
        provider: AI provider name
        model: Model name
        input_tokens: Number of input tokens
        output_tokens: Number of output tokens

    Returns:
        Estimated cost in USD
    """
    # Pricing per million tokens (MTok) - Updated 2026-09-26
    pricing = {
        "anthropic": {
            "claude-opus-5": {"input": 5.0, "output": 25.0},
            "claude-sonnet-5": {"input": 2.0, "output": 10.0},
            "claude-haiku-4-5": {"input": 1.0, "output": 5.0},
            "claude-3-5-sonnet-20241022": {"input": 3.0, "output": 15.0},
            "claude-3-5-sonnet": {"input": 3.0, "output": 15.0},
            "claude-3-5-haiku-20241022": {"input": 0.80, "output": 4.0},
            "claude-3-5-haiku": {"input": 0.80, "output": 4.0},
            "claude-3-opus": {"input": 15.0, "output": 75.0},
            "claude-3-sonnet": {"input": 3.0, "output": 15.0},
            "claude-3-haiku": {"input": 0.25, "output": 1.25},
        },
        "openai": {
            "gpt-4o": {"input": 2.5, "output": 10.0},
            "gpt-4o-mini": {"input": 0.15, "output": 0.6},
            "gpt-4-turbo": {"input": 10.0, "output": 30.0},
            "gpt-4": {"input": 30.0, "output": 60.0},
            "gpt-3.5-turbo": {"input": 0.5, "output": 1.5},
        },
        "gemini": {
            # Paid-tier prices. On Google's free tier these cost nothing.
            "gemini-3.8-flash": {"input": 0.75, "output": 3.75},
            "gemini-3.5-flash-lite": {"input": 0.30, "output": 2.50},
            "gemini-3.1-pro-preview": {"input": 0.0, "output": 0.0},
            "gemini-3-pro-preview": {"input": 0.0, "output": 0.0},
            # Gemini 2.5 Series (preview pricing)
            "gemini-2.5-flash": {"input": 0.0, "output": 0.0},
            "gemini-2.5-flash-lite": {"input": 0.0, "output": 0.0},
            "gemini-2.5-pro": {"input": 0.0, "output": 0.0},
        },
    }

    # Get pricing for the specific model
    provider_pricing = pricing.get(provider, {})
    model_pricing = provider_pricing.get(model)
    if model_pricing is None:
        return None

    # Calculate cost (tokens / 1,000,000 * price per MTok)
    input_cost = (input_tokens / 1_000_000) * model_pricing["input"]
    output_cost = (output_tokens / 1_000_000) * model_pricing["output"]

    return input_cost + output_cost


def track_api_request(method: str, endpoint: str, status_code: int, duration: float) -> None:
    """
    Track API request metrics

    Args:
        method: HTTP method
        endpoint: API endpoint path
        status_code: HTTP status code
        duration: Request duration in seconds
    """
    api_requests_total.labels(method=method, endpoint=endpoint, status=str(status_code)).inc()

    api_request_duration.labels(method=method, endpoint=endpoint).observe(duration)


def track_error(error_type: str, endpoint: str) -> None:
    """
    Track error occurrence

    Args:
        error_type: Type of error
        endpoint: Endpoint where error occurred
    """
    errors_total.labels(error_type=error_type, endpoint=endpoint).inc()
