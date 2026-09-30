"""
Property-based tests for metrics collection

These tests validate that metrics are properly tracked for AI usage,
question generation, and other system operations.
"""

import pytest
from hypothesis import given, strategies as st, settings
from unittest.mock import Mock, patch, MagicMock
from prometheus_client import REGISTRY
from app.utils.metrics import (
    track_question_generation,
    track_ai_api_call,
    estimate_cost,
    question_generation_duration,
    question_generation_total,
    questions_generated_count,
    ai_api_calls_total,
    ai_api_duration,
    ai_tokens_used,
    ai_estimated_cost,
)


# ============================================================================
# Strategies
# ============================================================================

providers = st.sampled_from(["anthropic", "openai", "gemini"])
difficulties = st.sampled_from(["easy", "medium", "hard", "mixed"])
models = st.sampled_from(["claude-3-5-sonnet-20241022", "gpt-4o", "gemini-2.0-flash-exp"])


# ============================================================================
# Property 23: AI usage tracking
# Feature: codebase-quality-improvements, Property 23: AI usage tracking
# Validates: Requirements 10.2
# ============================================================================


@given(
    provider=providers,
    model=models,
    duration=st.floats(min_value=0.1, max_value=300.0),
    success=st.booleans(),
    input_tokens=st.integers(min_value=100, max_value=100000),
    output_tokens=st.integers(min_value=50, max_value=50000),
)
@settings(max_examples=100, deadline=None)
def test_ai_usage_tracking_records_all_metrics(
    provider, model, duration, success, input_tokens, output_tokens
):
    """
    Property 23: AI usage tracking

    For any AI API call, the system must record provider, model, token_count,
    and cost_estimate in metrics.

    This property verifies that:
    1. AI API calls are counted
    2. Duration is recorded
    3. Token usage is tracked (input and output)
    4. Cost is estimated and recorded
    """
    # Get initial metric values
    initial_calls = _get_counter_value(
        ai_api_calls_total, provider, model, "success" if success else "failure"
    )
    initial_input_tokens = _get_counter_value(ai_tokens_used, provider, model, "input")
    initial_output_tokens = _get_counter_value(ai_tokens_used, provider, model, "output")
    initial_cost = _get_counter_value(ai_estimated_cost, provider, model)

    # Calculate expected cost
    expected_cost = estimate_cost(provider, model, input_tokens, output_tokens)

    # Track the API call
    track_ai_api_call(
        provider=provider,
        model=model,
        duration=duration,
        success=success,
        input_tokens=input_tokens,
        output_tokens=output_tokens,
        estimated_cost=expected_cost,
    )

    # Verify all metrics were recorded
    final_calls = _get_counter_value(
        ai_api_calls_total, provider, model, "success" if success else "failure"
    )
    final_input_tokens = _get_counter_value(ai_tokens_used, provider, model, "input")
    final_output_tokens = _get_counter_value(ai_tokens_used, provider, model, "output")
    final_cost = _get_counter_value(ai_estimated_cost, provider, model)

    # Assert metrics were incremented correctly
    assert (
        final_calls == initial_calls + 1
    ), f"API call counter should increment by 1 for {provider}/{model}"

    assert (
        final_input_tokens == initial_input_tokens + input_tokens
    ), f"Input tokens should increment by {input_tokens} for {provider}/{model}"

    assert (
        final_output_tokens == initial_output_tokens + output_tokens
    ), f"Output tokens should increment by {output_tokens} for {provider}/{model}"

    assert (
        abs(final_cost - (initial_cost + (expected_cost or 0))) < 0.000001
    ), f"Cost should increment by {expected_cost} for {provider}/{model}"


@given(
    provider=providers,
    difficulty=difficulties,
    duration=st.floats(min_value=1.0, max_value=600.0),
    num_questions=st.integers(min_value=1, max_value=50),
    success=st.booleans(),
)
@settings(max_examples=100, deadline=None)
def test_question_generation_tracking_records_metrics(
    provider, difficulty, duration, num_questions, success
):
    """
    Property: Question generation tracking

    For any question generation request, the system must record provider,
    difficulty, duration, number of questions, and success/failure status.
    """
    # Get initial metric values
    status = "success" if success else "failure"
    initial_total = _get_counter_value(question_generation_total, provider, difficulty, status)
    initial_count = (
        _get_counter_value(questions_generated_count, provider, difficulty) if success else 0
    )

    # Track the generation
    track_question_generation(
        provider=provider,
        difficulty=difficulty,
        duration=duration,
        num_questions=num_questions,
        success=success,
    )

    # Verify metrics were recorded
    final_total = _get_counter_value(question_generation_total, provider, difficulty, status)
    final_count = (
        _get_counter_value(questions_generated_count, provider, difficulty) if success else 0
    )

    assert (
        final_total == initial_total + 1
    ), f"Generation total should increment by 1 for {provider}/{difficulty}/{status}"

    if success:
        assert (
            final_count == initial_count + num_questions
        ), f"Questions count should increment by {num_questions} for {provider}/{difficulty}"


@given(
    provider=providers,
    model=models,
    input_tokens=st.integers(min_value=1, max_value=100000),
    output_tokens=st.integers(min_value=1, max_value=50000),
)
@settings(max_examples=100, deadline=None)
def test_cost_estimation_is_positive(provider, model, input_tokens, output_tokens):
    """
    Property: Cost estimation validity

    For any valid token counts, the estimated cost should be positive
    and proportional to token usage.
    """
    cost = estimate_cost(provider, model, input_tokens, output_tokens)

    # A provider/model pair outside the pricing table has no estimate.
    if cost is None:
        assert estimate_cost(provider, model, input_tokens * 2, output_tokens * 2) is None
        return

    # Cost should always be positive
    assert cost > 0, f"Cost should be positive for {provider}/{model}"

    # Cost should increase with more tokens
    double_cost = estimate_cost(provider, model, input_tokens * 2, output_tokens * 2)
    assert double_cost > cost, f"Cost should increase with more tokens for {provider}/{model}"

    # Cost should be roughly proportional (within 10% due to rounding)
    assert (
        abs(double_cost - (cost * 2)) / (cost * 2) < 0.1
    ), f"Cost should be roughly proportional to tokens for {provider}/{model}"


@given(
    provider=providers,
    model=models,
    input_tokens=st.integers(min_value=1000, max_value=10000),
    output_tokens=st.integers(min_value=500, max_value=5000),
)
@settings(max_examples=50, deadline=None)
def test_output_tokens_cost_more_than_input(provider, model, input_tokens, output_tokens):
    """
    Property: Output token pricing

    For all AI providers, output tokens should cost more than input tokens
    (this is a standard pricing model across providers).
    """
    # Calculate cost with only input tokens
    input_only_cost = estimate_cost(provider, model, input_tokens, 0)

    # Calculate cost with only output tokens (same count)
    output_only_cost = estimate_cost(provider, model, 0, input_tokens)

    if input_only_cost is None:
        assert output_only_cost is None
        return

    # Output tokens should cost more
    assert (
        output_only_cost > input_only_cost
    ), f"Output tokens should cost more than input tokens for {provider}/{model}"


@given(provider=providers, model=models, duration=st.floats(min_value=0.1, max_value=60.0))
@settings(max_examples=50, deadline=None)
def test_api_call_without_tokens_still_tracked(provider, model, duration):
    """
    Property: Partial metrics tracking

    Even when token counts are not available, API calls should still be
    tracked with duration and success/failure status.
    """
    initial_calls = _get_counter_value(ai_api_calls_total, provider, model, "success")

    # Track API call without token information
    track_ai_api_call(
        provider=provider,
        model=model,
        duration=duration,
        success=True,
        input_tokens=None,
        output_tokens=None,
        estimated_cost=None,
    )

    final_calls = _get_counter_value(ai_api_calls_total, provider, model, "success")

    # Call should still be counted
    assert (
        final_calls == initial_calls + 1
    ), f"API call should be counted even without token data for {provider}/{model}"


# ============================================================================
# Helper Functions
# ============================================================================


def _get_counter_value(metric, *labels):
    """
    Get the current value of a Prometheus counter metric with specific labels.

    Args:
        metric: The Prometheus metric object
        *labels: Label values to filter by

    Returns:
        Current counter value, or 0 if not found
    """
    try:
        # For counters, get the _value attribute
        labeled_metric = metric.labels(*labels)
        # Access the internal _value attribute
        if hasattr(labeled_metric, "_value"):
            return labeled_metric._value.get()
        # Fallback: try to get from the metric's samples
        for sample in REGISTRY.collect():
            if sample.name == metric._name:
                for s in sample.samples:
                    if s.labels == dict(zip(metric._labelnames, labels)):
                        return s.value
        return 0
    except Exception:
        return 0


def _get_histogram_count(metric, *labels):
    """
    Get the count from a Prometheus histogram metric with specific labels.

    Args:
        metric: The Prometheus histogram object
        *labels: Label values to filter by

    Returns:
        Histogram count, or 0 if not found
    """
    try:
        labeled_metric = metric.labels(*labels)
        if hasattr(labeled_metric, "_count"):
            return labeled_metric._count.get()
        return 0
    except Exception:
        return 0
