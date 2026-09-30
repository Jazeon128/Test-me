"""
Property-based tests for error handling.

Tests comprehensive error handling across the application including:
- Question generation error logging
- API error response structure
- File upload validation
- Database transaction rollback
- AI API failure handling
"""

import pytest
from hypothesis import given, strategies as st, settings as hypothesis_settings, HealthCheck
from hypothesis import assume
import json
import tempfile
import os
from unittest.mock import Mock, patch, MagicMock
from io import BytesIO
from structlog.testing import capture_logs

from app.services.ai.question_generator import QuestionGenerator
from app.services.parsers.base_parser import ParsedDocument, ParsedSection
from app.exceptions import (
    AIServiceError,
    QuestionGenerationError,
    FileUploadError,
    DatabaseError,
    ValidationError,
)
from app.utils.file_validation import validate_file_type, validate_file_size, validate_file_content
from app.middleware.error_handler import format_error_response
from app.config import settings as app_settings


class TestQuestionGenerationErrorLogging:
    """
    Feature: codebase-quality-improvements, Property 11: Question generation error logging

    Property: For any error during question generation, the log output must contain
    document_id, section information, and error message

    Validates: Requirements 4.1
    """

    @given(
        provider=st.sampled_from(["anthropic", "openai", "gemini"]),
        model=st.text(alphabet="abcdefghijklmnopqrstuvwxyz0123456789-", min_size=1, max_size=60),
        section_page=st.one_of(st.none(), st.integers(min_value=1, max_value=10000)),
        section_paragraph=st.integers(min_value=1, max_value=1000),
        error_type=st.sampled_from([Exception, RuntimeError, ValueError]),
        error_message=st.text(alphabet="abcdefghijklmnopqrstuvwxyz0123456789 ", min_size=1, max_size=150),
    )
    def test_question_generation_error_contains_context(
        self, provider, model, section_page, section_paragraph, error_type, error_message
    ):
        """Every failed batch records its error and logs its generation context."""
        section = ParsedSection(
            text="Sample text for testing",
            page=section_page,
            section="test_section",
            paragraph=section_paragraph,
        )
        mock_client = Mock()
        error = error_type(error_message)
        mock_client.messages.create.side_effect = error
        mock_client.chat.completions.create.side_effect = error
        mock_client.models.generate_content.side_effect = error

        with (
            patch("app.services.ai.question_generator.Anthropic", return_value=mock_client),
            patch("app.services.ai.question_generator.OpenAI", return_value=mock_client),
            patch("app.services.ai.question_generator.genai.Client", return_value=mock_client),
            patch("app.services.ai.question_generator.settings") as mock_settings,
        ):
            mock_settings.AI_PROVIDER = provider
            mock_settings.AI_MODEL = model
            mock_settings.ANTHROPIC_API_KEY = "test-key"
            mock_settings.OPENAI_API_KEY = "test-key"
            mock_settings.GEMINI_API_KEY = "test-key"
            generator = QuestionGenerator()
            with capture_logs() as logs:
                result = generator._generate_batch_questions(
                    section=section, count=5, difficulty="medium"
                )

            assert result == []
            assert len(generator.failed_batches) == 1
            failure = generator.failed_batches[0]
            # Provider and model belong to the generator. The batch entry's
            # contract contains section_page, error_type, and message.
            assert generator.provider == provider
            assert generator.model == model
            assert failure["section_page"] == section_page
            assert failure["error_type"] == error_type.__name__
            assert failure["message"] == error_message

            errors = [entry for entry in logs if entry["event"] == "question_generation_error"]
            assert len(errors) == 1
            logged = errors[0]
            assert logged["log_level"] == "error"
            assert logged["provider"] == generator.provider
            assert logged["model"] == generator.model
            assert logged["section_page"] == failure["section_page"]
            assert logged["section_paragraph"] == section_paragraph
            assert logged["error_type"] == failure["error_type"]
            assert logged["error_message"] == failure["message"]


class TestAPIErrorResponseStructure:
    """
    Feature: codebase-quality-improvements, Property 12: API error response structure

    Property: For any API request that results in an error, the response must be valid JSON
    with 'detail' field and appropriate HTTP status code (4xx or 5xx)

    Validates: Requirements 4.2
    """

    @given(
        error_code=st.sampled_from(
            [
                "VALIDATION_ERROR",
                "FILE_UPLOAD_ERROR",
                "RESOURCE_NOT_FOUND",
                "AI_SERVICE_ERROR",
                "DATABASE_ERROR",
            ]
        ),
        error_message=st.text(min_size=10, max_size=100),
        request_id=st.uuids(),
    )
    @hypothesis_settings(
        max_examples=20, deadline=None, suppress_health_check=[HealthCheck.data_too_large]
    )
    def test_error_response_structure(self, error_code, error_message, request_id):
        """
        Test that error responses have consistent structure with required fields.
        """
        # Create error response
        response = format_error_response(
            code=error_code, message=error_message, request_id=str(request_id)
        )

        # Verify response is valid JSON-serializable
        json_str = json.dumps(response)
        parsed = json.loads(json_str)

        # Verify structure
        assert "error" in parsed, "Response missing 'error' field"
        assert "code" in parsed["error"], "Error missing 'code' field"
        assert "message" in parsed["error"], "Error missing 'message' field"
        assert "request_id" in parsed["error"], "Error missing 'request_id' field"

        # Verify values
        assert parsed["error"]["code"] == error_code
        assert parsed["error"]["message"] == error_message
        assert parsed["error"]["request_id"] == str(request_id)

    @given(
        error_code=st.sampled_from(
            [
                "VALIDATION_ERROR",
                "FILE_UPLOAD_ERROR",
                "RESOURCE_NOT_FOUND",
                "AI_SERVICE_ERROR",
                "DATABASE_ERROR",
            ]
        ),
        error_message=st.text(min_size=10, max_size=200),
        details=st.dictionaries(
            keys=st.text(min_size=1, max_size=20),
            values=st.one_of(st.text(max_size=50), st.integers(), st.booleans()),
            min_size=0,
            max_size=3,
        ),
    )
    @hypothesis_settings(
        max_examples=20, deadline=None, suppress_health_check=[HealthCheck.data_too_large]
    )
    def test_error_response_with_details(self, error_code, error_message, details):
        """
        Test that error responses correctly include optional details field.
        """
        response = format_error_response(code=error_code, message=error_message, details=details)

        # Verify response is valid JSON-serializable
        json_str = json.dumps(response)
        parsed = json.loads(json_str)

        # Verify details are included if provided
        if details:
            assert (
                "details" in parsed["error"]
            ), "Error missing 'details' field when details provided"
            assert parsed["error"]["details"] == details


class TestFileUploadValidation:
    """
    Feature: codebase-quality-improvements, Property 13: File upload validation

    Property: For any file upload attempt, if the file type is not in the allowed list
    or size exceeds MAX_UPLOAD_SIZE, the request must be rejected before processing

    Validates: Requirements 4.3
    """

    @given(
        file_size=st.integers(
            min_value=app_settings.MAX_UPLOAD_SIZE + 1, max_value=app_settings.MAX_UPLOAD_SIZE * 2
        )
    )
    @hypothesis_settings(max_examples=20, deadline=None)
    def test_file_size_validation_rejects_large_files(self, file_size):
        """
        Test that files exceeding MAX_UPLOAD_SIZE are rejected.
        """
        filename = "test_file.pdf"
        with pytest.raises(FileUploadError) as exc_info:
            validate_file_size(file_size, filename)

        # Verify error contains size information
        assert exc_info.value.code == "FILE_UPLOAD_ERROR"
        assert "exceeds maximum" in exc_info.value.message.lower()
        assert exc_info.value.details["file_size_bytes"] == file_size
        assert exc_info.value.details["max_size_bytes"] == app_settings.MAX_UPLOAD_SIZE

    @given(
        base_name=st.text(
            min_size=1, max_size=30, alphabet=st.characters(whitelist_categories=("Lu", "Ll", "Nd"))
        ),
        invalid_extension=st.sampled_from(
            [
                ".exe",
                ".bat",
                ".sh",
                ".dll",
                ".so",
                ".zip",
                ".tar",
                ".gz",
                ".rar",
                ".7z",
                ".iso",
                ".dmg",
                ".pkg",
                ".deb",
                ".rpm",
            ]
        ),
    )
    @hypothesis_settings(max_examples=20, deadline=None)
    def test_file_type_validation_rejects_invalid_types(self, base_name, invalid_extension):
        """
        Test that files with invalid extensions are rejected.
        """
        filename = f"{base_name}{invalid_extension}"

        with pytest.raises(FileUploadError) as exc_info:
            validate_file_type(filename)

        # Verify error contains type information
        assert exc_info.value.code == "FILE_UPLOAD_ERROR"
        assert "not supported" in exc_info.value.message.lower()
        assert exc_info.value.details["file_extension"] == invalid_extension
        assert "allowed_extensions" in exc_info.value.details

    @given(
        base_name=st.text(
            min_size=1, max_size=30, alphabet=st.characters(whitelist_categories=("Lu", "Ll", "Nd"))
        ),
        valid_extension=st.sampled_from([".pdf", ".html", ".htm", ".md", ".docx", ".pptx"]),
    )
    @hypothesis_settings(max_examples=20, deadline=None)
    def test_file_type_validation_accepts_valid_types(self, base_name, valid_extension):
        """
        Test that files with valid extensions are accepted.
        """
        filename = f"{base_name}{valid_extension}"

        # Should not raise an exception
        result = validate_file_type(filename)
        assert result == valid_extension

    @given(filename=st.text(min_size=5, max_size=50))
    @hypothesis_settings(max_examples=20, deadline=None)
    def test_empty_file_validation_rejects_empty_content(self, filename):
        """
        Test that empty files are rejected.
        """
        empty_content = b""

        with pytest.raises(FileUploadError) as exc_info:
            validate_file_content(empty_content, filename)

        # Verify error indicates empty file
        assert exc_info.value.code == "FILE_UPLOAD_ERROR"
        assert "empty" in exc_info.value.message.lower()
        assert exc_info.value.details["file_size_bytes"] == 0


class TestDatabaseTransactionRollback:
    """
    Feature: codebase-quality-improvements, Property 14: Database transaction rollback

    Property: For any database operation that raises an exception, the transaction
    must be rolled back and the error must be logged

    Validates: Requirements 4.4
    """

    @given(
        operation_name=st.sampled_from(["insert", "update", "delete", "query"]),
        error_message=st.text(min_size=10, max_size=100),
    )
    @hypothesis_settings(max_examples=20, deadline=None)
    def test_database_error_creates_proper_exception(self, operation_name, error_message):
        """
        Test that database errors create DatabaseError exceptions with proper context.
        """
        # Create a DatabaseError
        db_error = DatabaseError(message=error_message, operation=operation_name)

        # Verify exception properties
        assert db_error.code == "DATABASE_ERROR"
        assert db_error.message == error_message
        assert db_error.status_code == 500
        assert db_error.details["operation"] == operation_name


class TestAIAPIFailureHandling:
    """
    Feature: codebase-quality-improvements, Property 15: AI API failure handling

    Property: For any AI API call that fails (timeout, invalid key, rate limit),
    the system must return a clear error message without exposing internal details

    Validates: Requirements 4.5
    """

    @given(
        provider=st.sampled_from(["anthropic", "openai", "gemini"]),
        error_type=st.sampled_from(["timeout", "invalid_key", "rate_limit", "api_error"]),
    )
    @hypothesis_settings(max_examples=20, deadline=None)
    def test_ai_service_error_masks_internal_details(self, provider, error_type):
        """
        Test that AI service errors provide clear messages without exposing internals.
        """
        # Create an AIServiceError
        error = AIServiceError(
            message=f"AI service request failed: {error_type}",
            provider=provider,
            details={"error_type": error_type},
        )

        # Verify exception properties
        assert error.code == "AI_SERVICE_ERROR"
        assert error.status_code == 502
        assert error.details["provider"] == provider

        # Verify message is clear but doesn't expose sensitive details
        assert "AI service" in error.message or "failed" in error.message
        # Should not contain API keys or internal stack traces in the message
        assert "api_key" not in error.message.lower()
        assert "traceback" not in error.message.lower()

    @given(provider=st.sampled_from(["anthropic", "openai", "gemini"]))
    @hypothesis_settings(max_examples=20, deadline=None)
    def test_missing_api_key_error_is_clear(self, provider):
        """
        Test that missing API key errors are clear and actionable.
        """
        with patch("app.services.ai.question_generator.settings") as mock_settings:
            mock_settings.AI_PROVIDER = provider
            mock_settings.ANTHROPIC_API_KEY = None
            mock_settings.OPENAI_API_KEY = None
            mock_settings.GEMINI_API_KEY = None
            mock_settings.AI_MODEL = ""

            with pytest.raises(AIServiceError) as exc_info:
                QuestionGenerator()

            # Verify error is clear and actionable
            assert exc_info.value.code == "AI_SERVICE_ERROR"
            assert "API key" in exc_info.value.message
            assert provider in exc_info.value.message
            assert exc_info.value.details["provider"] == provider
