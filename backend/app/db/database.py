from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from typing import Generator
from ..config import settings

engine = create_engine(
    settings.DATABASE_URL,
    connect_args={"check_same_thread": False} if "sqlite" in settings.DATABASE_URL else {},
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db() -> Generator[Session, None, None]:
    """Dependency for FastAPI to get database session"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    """
    Initialize database tables
    Optimized for fast startup - only creates tables if they don't exist
    Requirements 8.2: Optimize database initialization for 3 second startup target
    """
    from ..models import Base
    from sqlalchemy import inspect

    # Check if tables already exist (fast operation)
    inspector = inspect(engine)
    existing_tables = inspector.get_table_names()

    # Only create tables if database is empty or missing tables
    if not existing_tables or len(existing_tables) == 0:
        # Full table creation (only on first run)
        Base.metadata.create_all(bind=engine)
    else:
        # Tables exist, skip creation (fast path)
        # Note: For schema migrations, use Alembic instead
        pass
