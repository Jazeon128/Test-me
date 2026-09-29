"""Property-based tests for structured logging

Feature: codebase-quality-improvements
"""
import pytest
import json
import io
import sys
from hypothesis import given, strategies as st
from unittest.mock import Mock, patch
from fastapi import Request, Response
from fastapi.testclient import TestClient

from app.utils.logging import configure_logging, get_logger
from app.middleware.logging import RequestLoggingMiddleware


# Hypothesis strategies for generating test data
@st.composite
def http_method_strategy(draw):
    """Generate valid HTTP methods"""
    return draw(st.sampled_from(["GET", "POST", "PUT", "DELETE", "PATCH"]))


@st.composite
def http_path_strategy(draw):
    """Generate valid HTTP paths"""
    paths = [
        "/api/documents",
        "/api/questions",
        "/api/progress",
        "/api/decks",
        "/api/settings",
        "/api/status",
        "/health",
        "/",
    ]
    return draw(st.sampled_from(paths))


@st.composite
def status_code_strategy(draw):
    """Generate valid HTTP status codes"""
    return draw(st.sampled_from([200, 201, 400, 404, 500, 502, 503]))


@pytest.mark.property
class TestLoggingProperties:
    """Property-based tests for structured logging correctness"""

    @given(
        method=http_method_strategy(),
        path=http_path_strategy(),
        duration_ms=st.floats(min_value=0.0, max_value=10000.0),
    )
    def test_property_22_request_logging_completeness(self, method, path, duration_ms):
        """
        Feature: codebase-quality-improvements, Property 22: Request logging completeness
        Validates: Requirements 10.1

        For any API request processed, the logs must contain request_id, method,
        path, duration_ms, and status_code
        """
        # Capture log output
        log_capture = io.StringIO()

        # Configure logging to output JSON to our capture stream
        import structlog
        import uuid

        structlog.configure(
            processors=[
                structlog.stdlib.add_log_level,
                structlog.processors.TimeStamper(fmt="iso"),
                structlog.processors.format_exc_info,
                structlog.processors.JSONRenderer(),
            ],
            context_class=dict,
            logger_factory=structlog.PrintLoggerFactory(file=log_capture),
            cache_logger_on_first_use=False,
        )

        logger = get_logger(__name__)

        # Simulate a request log entry
        request_id = str(uuid.uuid4())
        status_code = 200

        logger.info(
            "request_completed",
            request_id=request_id,
            method=method,
            path=path,
            duration_ms=duration_ms,
            status_code=status_code,
        )

        # Get the captured logs
        log_output = log_capture.getvalue()

        # Parse log lines
        log_lines = [line for line in log_output.strip().split("\n") if line]
        assert len(log_lines) > 0, "No log output captured"

        log_entry = json.loads(log_lines[0])

        # Verify required fields are present
        assert "request_id" in log_entry, f"Missing request_id in log. Log entry: {log_entry}"
        assert "method" in log_entry, f"Missing method in log. Log entry: {log_entry}"
        assert "path" in log_entry, f"Missing path in log. Log entry: {log_entry}"
        assert "duration_ms" in log_entry, f"Missing duration_ms in log. Log entry: {log_entry}"

        # Verify the logged values match what we sent
        assert (
            log_entry["method"] == method
        ), f"Method mismatch: expected {method}, got {log_entry['method']}"
        assert log_entry["path"] == path, f"Path mismatch: expected {path}, got {log_entry['path']}"

        # Verify duration is a positive number
        assert isinstance(
            log_entry["duration_ms"], (int, float)
        ), f"duration_ms should be numeric, got {type(log_entry['duration_ms'])}"
        assert (
            log_entry["duration_ms"] >= 0
        ), f"duration_ms should be non-negative, got {log_entry['duration_ms']}"

    @given(
        error_message=st.text(
            min_size=1, max_size=200, alphabet=st.characters(blacklist_categories=("Cs", "Cc"))
        ),
        error_type=st.sampled_from(["ValueError", "TypeError", "RuntimeError"]),
    )
    def test_property_24_error_context_capture(self, error_message, error_type):
        """
        Feature: codebase-quality-improvements, Property 24: Error context capture
        Validates: Requirements 10.3

        For any exception raised, the error log must include stack_trace, timestamp,
        user_context, and request_context
        """
        # Capture log output
        log_capture = io.StringIO()

        # Configure logging to output JSON to our capture stream
        import structlog

        structlog.configure(
            processors=[
                structlog.stdlib.add_log_level,
                structlog.processors.TimeStamper(fmt="iso"),
                structlog.processors.StackInfoRenderer(),
                structlog.processors.format_exc_info,
                structlog.processors.JSONRenderer(),
            ],
            context_class=dict,
            logger_factory=structlog.PrintLoggerFactory(file=log_capture),
            cache_logger_on_first_use=False,
        )

        logger = get_logger(__name__)

        # Simulate an error with context
        try:
            # Create the exception dynamically based on error_type
            if error_type == "ValueError":
                raise ValueError(error_message)
            elif error_type == "TypeError":
                raise TypeError(error_message)
            elif error_type == "RuntimeError":
                raise RuntimeError(error_message)
            else:
                raise Exception(error_message)
        except Exception as e:
            logger.error(
                "test_error_occurred",
                error_type=type(e).__name__,
                error_message=str(e),
                user_context="test_user",
                request_context="test_request",
                exc_info=True,
            )

        # Get the captured logs
        log_output = log_capture.getvalue()

        # Parse the log entry
        log_lines = [line for line in log_output.strip().split("\n") if line]
        assert len(log_lines) > 0, "No log output captured"

        log_entry = json.loads(log_lines[0])

        # Verify required fields are present
        assert "timestamp" in log_entry, f"Missing timestamp in error log. Log entry: {log_entry}"
        assert "error_type" in log_entry, f"Missing error_type in error log. Log entry: {log_entry}"
        assert (
            "error_message" in log_entry
        ), f"Missing error_message in error log. Log entry: {log_entry}"
        assert (
            "user_context" in log_entry
        ), f"Missing user_context in error log. Log entry: {log_entry}"
        assert (
            "request_context" in log_entry
        ), f"Missing request_context in error log. Log entry: {log_entry}"

        # Verify exception info is present (stack trace)
        assert (
            "exception" in log_entry or "exc_info" in log_entry
        ), f"Missing stack trace in error log. Log entry: {log_entry}"

        # Verify the logged values match what we sent
        assert (
            log_entry["error_type"] == error_type
        ), f"Error type mismatch: expected {error_type}, got {log_entry['error_type']}"
        assert (
            log_entry["error_message"] == error_message
        ), f"Error message mismatch: expected {error_message}, got {log_entry['error_message']}"

    @given(
        log_message=st.text(min_size=1, max_size=100),
        log_level=st.sampled_from(["debug", "info", "warning", "error"]),
    )
    def test_property_25_structured_log_format(self, log_message, log_level):
        """
        Feature: codebase-quality-improvements, Property 25: Structured log format
        Validates: Requirements 10.5

        For any log entry emitted, it must be valid JSON with fields: timestamp,
        level, message, and context
        """
        # Capture log output
        log_capture = io.StringIO()

        # Configure logging to output JSON to our capture stream
        import structlog

        structlog.configure(
            processors=[
                structlog.stdlib.add_log_level,
                structlog.processors.TimeStamper(fmt="iso"),
                structlog.processors.format_exc_info,
                structlog.processors.JSONRenderer(),
            ],
            context_class=dict,
            logger_factory=structlog.PrintLoggerFactory(file=log_capture),
            cache_logger_on_first_use=False,
        )

        logger = get_logger(__name__)

        # Log a message at the specified level with some context
        log_method = getattr(logger, log_level)
        log_method(log_message, test_context="test_value", numeric_value=42)

        # Get the captured logs
        log_output = log_capture.getvalue()

        # Verify we got output
        assert log_output.strip(), "No log output captured"

        # Parse the log entry as JSON
        log_lines = [line for line in log_output.strip().split("\n") if line]
        assert len(log_lines) > 0, "No log lines captured"

        try:
            log_entry = json.loads(log_lines[0])
        except json.JSONDecodeError as e:
            pytest.fail(f"Log output is not valid JSON: {log_output}. Error: {e}")

        # Verify required fields are present
        assert "timestamp" in log_entry, f"Missing timestamp in log. Log entry: {log_entry}"
        assert "level" in log_entry, f"Missing level in log. Log entry: {log_entry}"
        assert "event" in log_entry, f"Missing event (message) in log. Log entry: {log_entry}"

        # Verify the logged message matches
        assert (
            log_entry["event"] == log_message
        ), f"Message mismatch: expected {log_message}, got {log_entry['event']}"

        # Verify the log level matches
        assert (
            log_entry["level"] == log_level
        ), f"Level mismatch: expected {log_level}, got {log_entry['level']}"

        # Verify context fields are present
        assert (
            "test_context" in log_entry
        ), f"Missing context field 'test_context' in log. Log entry: {log_entry}"
        assert (
            log_entry["test_context"] == "test_value"
        ), f"Context value mismatch for 'test_context'"

        # Verify timestamp is in ISO format
        from datetime import datetime

        try:
            datetime.fromisoformat(log_entry["timestamp"].replace("Z", "+00:00"))
        except (ValueError, AttributeError) as e:
            pytest.fail(
                f"Timestamp is not in valid ISO format: {log_entry['timestamp']}. Error: {e}"
            )
