from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import model_validator
from pathlib import Path, PurePosixPath
from typing import List
import os
import sys

BACKEND_DIR = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    """Application settings"""

    # Database
    DATABASE_URL: str = "sqlite:///./test_me.db"

    # AI Configuration
    ANTHROPIC_API_KEY: str = ""
    OPENAI_API_KEY: str = ""
    GEMINI_API_KEY: str = ""
    OPENROUTER_API_KEY: str = ""
    AI_PROVIDER: str = "anthropic"  # "anthropic", "openai", or "gemini"
    AI_MODEL: str = ""  # Optional: specific model to use

    # Canvas template routing (TypeSafe / Jev). Optional: without it the canvas
    # asks the person which form to draw instead of choosing one.
    TYPESAFE_API_KEY: str = ""

    # Optional path to a CA bundle. Needed on a machine whose HTTPS is
    # intercepted, by a corporate proxy or by antivirus scanning TLS: without
    # the intercepting root in a bundle the HTTP clients trust, every provider
    # call fails the handshake. Applied to the environment at startup so the
    # SDKs pick it up.
    CA_BUNDLE: str = ""

    # Application
    DEBUG: bool = True
    HOST: str = "127.0.0.1"
    PORT: int = 8000
    SECRET_KEY: str = os.getenv("SECRET_KEY", "dev-secret-key-change-in-production")
    CORS_ORIGINS_STR: str = "http://localhost:5173,http://localhost:3000"
    ENVIRONMENT: str = "development"  # development, staging, production
    LOG_LEVEL: str = "INFO"  # DEBUG, INFO, WARNING, ERROR, CRITICAL

    # File Upload
    MAX_UPLOAD_SIZE: int = 10485760  # 10MB
    UPLOAD_DIR: str = "./uploads"

    @model_validator(mode="after")
    def resolve_paths(self) -> "Settings":
        sqlite_prefix = "sqlite:///"
        if self.DATABASE_URL.startswith(sqlite_prefix):
            database_path = self.DATABASE_URL[len(sqlite_prefix):]
            if (
                database_path
                and database_path != ":memory:"
                and not Path(database_path).is_absolute()
                and not PurePosixPath(database_path).is_absolute()
            ):
                self.DATABASE_URL = sqlite_prefix + (BACKEND_DIR / database_path).resolve().as_posix()
        if not Path(self.UPLOAD_DIR).is_absolute():
            self.UPLOAD_DIR = str((BACKEND_DIR / self.UPLOAD_DIR).resolve())
        return self

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
        if self.AI_PROVIDER not in ["anthropic", "openai", "gemini", "openrouter"]:
            errors.append(
                f"AI_PROVIDER must be one of: anthropic, openai, gemini, openrouter. Got: {self.AI_PROVIDER}"
            )

        # A missing API key is a warning, not an error. Keys entered in Settings
        # go to the OS credential store, and backend/.env is the alternative, so
        # the app must start without one: that is how a new user reaches Settings.
        provider_key_map = {
            "anthropic": self.ANTHROPIC_API_KEY,
            "openai": self.OPENAI_API_KEY,
            "gemini": self.GEMINI_API_KEY,
            "openrouter": self.OPENROUTER_API_KEY,
        }
        if not provider_key_map.get(self.AI_PROVIDER):
            warnings.append(
                f"No {self.AI_PROVIDER.upper()}_API_KEY in the environment. "
                "Question generation will use a key saved in Settings (OS credential store)."
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

    model_config = SettingsConfigDict(
        env_file=str(BACKEND_DIR / ".env"),
        case_sensitive=True,
        extra="ignore",  # Ignore extra fields in .env file
    )


settings = Settings()
