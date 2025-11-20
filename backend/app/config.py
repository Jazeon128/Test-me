from pydantic_settings import BaseSettings
from typing import List
import os


class Settings(BaseSettings):
    """Application settings"""

    # Database
    DATABASE_URL: str = "sqlite:///./test_me.db"

    # AI Configuration
    ANTHROPIC_API_KEY: str = ""
    OPENAI_API_KEY: str = ""
    GEMINI_API_KEY: str = ""
    AI_PROVIDER: str = "anthropic"  # "anthropic", "openai", or "gemini"

    # Application
    DEBUG: bool = True
    SECRET_KEY: str = os.getenv("SECRET_KEY", "dev-secret-key-change-in-production")
    CORS_ORIGINS_STR: str = "http://localhost:5173,http://localhost:3000"

    # File Upload
    MAX_UPLOAD_SIZE: int = 10485760  # 10MB
    UPLOAD_DIR: str = "./uploads"

    @property
    def CORS_ORIGINS(self) -> List[str]:
        """Get CORS origins as a list"""
        cors_str = os.getenv("CORS_ORIGINS_STR", self.CORS_ORIGINS_STR)
        return [origin.strip() for origin in cors_str.split(",") if origin.strip()]

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
