from pydantic_settings import BaseSettings
from typing import List
import os
import sys


class Settings(BaseSettings):
    """Application settings"""

    # Database
    DATABASE_URL: str = "sqlite:///./test_me.db"

    # AI Configuration
    ANTHROPIC_API_KEY: str = ""
    OPENAI_API_KEY: str = ""
    GEMINI_API_KEY: str = ""
    AI_PROVIDER: str = "anthropic"  # "anthropic", "openai", or "gemini"
    AI_MODEL: str = ""  # Optional: specific model to use

    # Canvas template routing (TypeSafe / Jev). Optional: without it the canvas
    # asks the person which form to draw instead of choosing one.
    TYPESAFE_API_KEY: str = ""

    # Application
    DEBUG: bool = True
    SECRET_KEY: str = os.getenv("SECRET_KEY", "dev-secret-key-change-in-production")
    CORS_ORIGINS_STR: str = "http://localhost:5173,http://localhost:3000"
    ENVIRONMENT: str = "development"  # development, staging, production
    LOG_LEVEL: str = "INFO"  # DEBUG, INFO, WARNING, ERROR, CRITICAL

    # File Upload
    MAX_UPLOAD_SIZE: int = 10485760  # 10MB
    UPLOAD_DIR: str = "./uploads"

    @property
    def CORS_ORIGINS(self) -> List[str]:
        """Get CORS origins as a list"""
        cors_str = os.getenv("CORS_ORIGINS_STR", self.CORS_ORIGINS_STR)
        return [origin.strip() for origin in cors_str.split(",") if origin.strip()]

    def validate_required_settings(self) -> None:
        """
        Validate that required settings are properly configured.

        Raises:
            ValueError: If required settings are missing or invalid
        """
        errors = []
        warnings = []

        # Validate AI Provider configuration
        if self.AI_PROVIDER not in ["anthropic", "openai", "gemini"]:
            errors.append(
                f"AI_PROVIDER must be one of: anthropic, openai, gemini. Got: {self.AI_PROVIDER}"
            )

        # A missing API key is a warning, not an error. The key is normally stored
        # in the settings table and entered through the Settings screen, so the app
        # must start without one: that is how a new user reaches the screen at all.
        provider_key_map = {
            "anthropic": self.ANTHROPIC_API_KEY,
            "openai": self.OPENAI_API_KEY,
            "gemini": self.GEMINI_API_KEY,
        }
        if not provider_key_map.get(self.AI_PROVIDER):
            warnings.append(
                f"No {self.AI_PROVIDER.upper()}_API_KEY in the environment. "
                "Question generation will use the key stored in Settings."
            )

        # Validate SECRET_KEY in production
        if (
            self.ENVIRONMENT == "production"
            and self.SECRET_KEY == "dev-secret-key-change-in-production"
        ):
            errors.append("SECRET_KEY must be changed from default value in production environment")

        # Validate LOG_LEVEL
        valid_log_levels = ["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"]
        if self.LOG_LEVEL.upper() not in valid_log_levels:
            errors.append(
                f"LOG_LEVEL must be one of: {', '.join(valid_log_levels)}. Got: {self.LOG_LEVEL}"
            )

        # Validate ENVIRONMENT
        valid_environments = ["development", "staging", "production"]
        if self.ENVIRONMENT not in valid_environments:
            errors.append(
                f"ENVIRONMENT must be one of: {', '.join(valid_environments)}. Got: {self.ENVIRONMENT}"
            )

        # Validate MAX_UPLOAD_SIZE
        if self.MAX_UPLOAD_SIZE <= 0:
            errors.append(
                f"MAX_UPLOAD_SIZE must be a positive integer. Got: {self.MAX_UPLOAD_SIZE}"
            )

        for warning in warnings:
            print(f"Configuration warning: {warning}", file=sys.stderr)

        # Raise rather than sys.exit. This runs inside the ASGI startup hook, so
        # killing the interpreter takes the test client's whole process with it.
        # The entrypoint in main.py turns this into a readable exit.
        if errors:
            raise ValueError(
                "Configuration validation failed:\n"
                + "\n".join(f"  {i}. {error}" for i, error in enumerate(errors, 1))
                + "\n\nCheck your .env file. See .env.example for reference."
            )

    class Config:
        env_file = ".env"
        case_sensitive = True
        extra = "ignore"  # Ignore extra fields in .env file


settings = Settings()
