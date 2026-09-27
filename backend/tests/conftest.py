"""Pytest configuration and fixtures.

The database and upload directory are redirected to a temporary location in the
rootdir conftest.py, which pytest loads before any application module.
"""

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from fastapi.testclient import TestClient

from app.models.base import Base
from app.db.database import get_db

# These model imports look unused, but importing a model registers its table on
# Base.metadata. Dropping one would silently leave that table out of the schema
# every test builds.
from app.models.document import Document
from app.models.question import Question, QuestionOption
from app.models.test import Test
from app.models.user_progress import UserProgress
from app.models.settings import Settings  # noqa: F401
from app.models.notebook import Notebook  # noqa: F401
from app.models.canvas import Canvas, CanvasRoutingLog  # noqa: F401


@pytest.fixture(scope="function")
def db_session():
    """Create a fresh database session for each test"""
    # Use in-memory SQLite database for testing
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )

    # Create all tables
    Base.metadata.create_all(bind=engine)

    # Create session
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    session = TestingSessionLocal()

    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture(scope="function")
def client(db_session):
    """Create a test client with database session override"""
    from main import app

    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db

    with TestClient(app) as test_client:
        yield test_client

    app.dependency_overrides.clear()


@pytest.fixture
def sample_document(db_session):
    """Create a sample document for testing"""
    from app.models.document import DocumentType

    doc = Document(
        filename="test_document.pdf",
        original_filename="test_document.pdf",
        file_path="/uploads/test_document.pdf",
        file_type=DocumentType.PDF,
        file_size=1024,
        content="This is a test document content about Python programming.",
        title="Test Document",
        num_pages=10,
    )
    db_session.add(doc)
    db_session.commit()
    db_session.refresh(doc)
    return doc


@pytest.fixture
def sample_question(db_session, sample_document):
    """Create a sample question with options"""
    question = Question(
        document_id=sample_document.id,
        question_text="What is Python?",
        explanation="Python is a high-level programming language.",
        difficulty="medium",
        source_reference={"page": 1, "section": "Introduction", "text": "Python programming"},
    )
    db_session.add(question)
    db_session.flush()

    # Add options
    options = [
        QuestionOption(
            question_id=question.id, option_text="A programming language", is_correct=True, order=0
        ),
        QuestionOption(question_id=question.id, option_text="A snake", is_correct=False, order=1),
        QuestionOption(
            question_id=question.id, option_text="A framework", is_correct=False, order=2
        ),
        QuestionOption(
            question_id=question.id, option_text="A database", is_correct=False, order=3
        ),
    ]

    for option in options:
        db_session.add(option)

    db_session.commit()
    db_session.refresh(question)
    return question


@pytest.fixture
def sample_test(db_session, sample_question):
    """Create a sample test/deck"""
    test = Test(name="Python Basics Test", description="Test covering Python fundamentals")
    db_session.add(test)
    db_session.flush()

    # Use the questions setter to properly create TestQuestion association
    test.questions = [sample_question]
    db_session.commit()
    db_session.refresh(test)
    return test


@pytest.fixture
def sample_user_progress(db_session, sample_question):
    """Create sample user progress for a question"""
    progress = UserProgress(
        question_id=sample_question.id,
        easiness_factor=2.5,
        interval=1,
        repetitions=0,
        next_review_date=None,
        times_seen=0,
        times_correct=0,
        times_incorrect=0,
        average_time_seconds=0.0,
        streak=0,
        best_streak=0,
        is_mastered=False,
    )
    db_session.add(progress)
    db_session.commit()
    db_session.refresh(progress)
    return progress
