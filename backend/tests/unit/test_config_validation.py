"""Unit tests for configuration validation"""
import pytest
import sys
from unittest.mock import patch
from app.config import Settings


class TestConfigValidation:
    """Tests for configuration validation"""

    def test_valid_configuration(self):
        """Test that valid configuration passes validation"""
        settings = Settings(
            ANTHROPIC_API_KEY="test-key",
            AI_PROVIDER="anthropic",
            SECRET_KEY="test-secret-key",
            ENVIRONMENT="development",
            LOG_LEVEL="INFO",
            MAX_UPLOAD_SIZE=10485760,
        )
        # Should not raise any exception
        settings.validate_required_settings()

    def test_invalid_ai_provider(self):
        """Test that invalid AI provider fails validation"""
        settings = Settings(
            ANTHROPIC_API_KEY="test-key",
            AI_PROVIDER="invalid-provider",
            SECRET_KEY="test-secret-key",
        )
        with pytest.raises(ValueError):
            settings.validate_required_settings()

    def test_no_api_keys_configured(self):
        """Missing API keys must warn, not fail.

        The key is normally stored in the settings table and entered through the
        Settings screen, so the app has to start without one for a new user to
        reach that screen.
        """
        settings = Settings(
            ANTHROPIC_API_KEY="",
            OPENAI_API_KEY="",
            GEMINI_API_KEY="",
            AI_PROVIDER="anthropic",
            SECRET_KEY="test-secret-key",
        )
        settings.validate_required_settings()

    def test_provider_without_key(self):
        """Selected provider without its API key must warn, not fail."""
        settings = Settings(
            ANTHROPIC_API_KEY="",
            OPENAI_API_KEY="test-key",
            AI_PROVIDER="anthropic",  # Provider set to anthropic but no key
            SECRET_KEY="test-secret-key",
        )
        settings.validate_required_settings()

    def test_production_with_default_secret(self):
        """Test that production environment with default secret fails validation"""
        settings = Settings(
            ANTHROPIC_API_KEY="test-key",
            AI_PROVIDER="anthropic",
            SECRET_KEY="dev-secret-key-change-in-production",
            ENVIRONMENT="production",
        )
        with pytest.raises(ValueError):
            settings.validate_required_settings()

    def test_invalid_log_level(self):
        """Test that invalid log level fails validation"""
        settings = Settings(
            ANTHROPIC_API_KEY="test-key",
            AI_PROVIDER="anthropic",
            SECRET_KEY="test-secret-key",
            LOG_LEVEL="INVALID",
        )
        with pytest.raises(ValueError):
            settings.validate_required_settings()

    def test_invalid_environment(self):
        """Test that invalid environment fails validation"""
        settings = Settings(
            ANTHROPIC_API_KEY="test-key",
            AI_PROVIDER="anthropic",
            SECRET_KEY="test-secret-key",
            ENVIRONMENT="invalid-env",
        )
        with pytest.raises(ValueError):
            settings.validate_required_settings()

    def test_invalid_max_upload_size(self):
        """Test that invalid max upload size fails validation"""
        settings = Settings(
            ANTHROPIC_API_KEY="test-key",
            AI_PROVIDER="anthropic",
            SECRET_KEY="test-secret-key",
            MAX_UPLOAD_SIZE=-1,
        )
        with pytest.raises(ValueError):
            settings.validate_required_settings()

    def test_cors_origins_property(self):
        """Test CORS_ORIGINS property parsing"""
        settings = Settings(
            ANTHROPIC_API_KEY="test-key",
            AI_PROVIDER="anthropic",
            CORS_ORIGINS_STR="http://localhost:3000,http://localhost:5173",
        )
        origins = settings.CORS_ORIGINS
        assert len(origins) == 2
        assert "http://localhost:3000" in origins
        assert "http://localhost:5173" in origins

    def test_cors_origins_with_spaces(self):
        """Test CORS_ORIGINS property handles spaces"""
        settings = Settings(
            ANTHROPIC_API_KEY="test-key",
            AI_PROVIDER="anthropic",
            CORS_ORIGINS_STR="http://localhost:3000 , http://localhost:5173",
        )
        origins = settings.CORS_ORIGINS
        assert len(origins) == 2
        assert "http://localhost:3000" in origins
        assert "http://localhost:5173" in origins

    def test_all_providers_configured(self):
        """Test that having all providers configured is valid"""
        settings = Settings(
            ANTHROPIC_API_KEY="anthropic-key",
            OPENAI_API_KEY="openai-key",
            GEMINI_API_KEY="gemini-key",
            AI_PROVIDER="openai",
            SECRET_KEY="test-secret-key",
        )
        # Should not raise any exception
        settings.validate_required_settings()
