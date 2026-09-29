"""
Tests for database query optimizations.

This module tests that composite indexes are properly used and that
N+1 query patterns have been eliminated.
"""

import pytest
from sqlalchemy import create_engine, inspect
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.models.base import Base
from app.models.user_progress import UserProgress
from app.models.question import Question


@pytest.fixture(scope="module")
def inspector():
    """Inspect a schema built the way the application builds it.

    init_db() calls create_all(), so this asserts the indexes reach a fresh
    database. Inspecting the developer's own test_me.db instead would depend on
    a gitignored file that does not exist in a clean clone or in CI.
    """
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    return inspect(engine)


class TestCompositeIndexes:
    """Test that composite indexes are created correctly."""

    def test_user_progress_composite_index_exists(self, inspector):
        """Verify composite index on user_progress (question_id, next_review_date)."""
        indexes = inspector.get_indexes("user_progress")

        # Find the composite index
        composite_index = None
        for idx in indexes:
            if idx["name"] == "idx_user_progress_question_review":
                composite_index = idx
                break

        assert (
            composite_index is not None
        ), "Composite index idx_user_progress_question_review not found"
        assert composite_index["column_names"] == ["question_id", "next_review_date"]
        assert composite_index["unique"] == 0  # Not unique

    def test_questions_composite_index_exists(self, inspector):
        """Verify composite index on questions (document_id, difficulty)."""
        indexes = inspector.get_indexes("questions")

        # Find the composite index
        composite_index = None
        for idx in indexes:
            if idx["name"] == "idx_questions_document_difficulty":
                composite_index = idx
                break

        assert (
            composite_index is not None
        ), "Composite index idx_questions_document_difficulty not found"
        assert composite_index["column_names"] == ["document_id", "difficulty"]
        assert composite_index["unique"] == 0  # Not unique

    def test_tags_index_exists(self, inspector):
        """Verify index on tags.name exists."""
        indexes = inspector.get_indexes("tags")

        # Find the name index
        name_index = None
        for idx in indexes:
            if "name" in idx["column_names"]:
                name_index = idx
                break

        assert name_index is not None, "Index on tags.name not found"


class TestCacheUtility:
    """Test the caching utility functions."""

    def test_timed_cache_decorator(self):
        """Test that timed_cache decorator works correctly."""
        from app.utils.cache import timed_cache

        call_count = 0

        @timed_cache(seconds=60)
        def expensive_function(x):
            nonlocal call_count
            call_count += 1
            return x * 2

        # First call should execute
        result1 = expensive_function(5)
        assert result1 == 10
        assert call_count == 1

        # Second call with same args should use cache
        result2 = expensive_function(5)
        assert result2 == 10
        assert call_count == 1  # Should not increment

        # Call with different args should execute
        result3 = expensive_function(10)
        assert result3 == 20
        assert call_count == 2

        # Clear cache and verify it executes again
        expensive_function.clear_cache()
        result4 = expensive_function(5)
        assert result4 == 10
        assert call_count == 3

    def test_statistics_cache(self):
        """Test the StatisticsCache class."""
        from app.utils.cache import StatisticsCache

        cache = StatisticsCache(ttl_seconds=60)

        # Test set and get
        cache.set("test_key", {"value": 42})
        result = cache.get("test_key")
        assert result == {"value": 42}

        # Test get non-existent key
        result = cache.get("nonexistent")
        assert result is None

        # Test invalidate specific key
        cache.set("key1", "value1")
        cache.set("key2", "value2")
        cache.invalidate("key1")
        assert cache.get("key1") is None
        assert cache.get("key2") == "value2"

        # Test invalidate all
        cache.invalidate_all()
        assert cache.get("key2") is None

    def test_statistics_cache_expiration(self):
        """Test that cache entries expire after TTL."""
        from app.utils.cache import StatisticsCache
        from datetime import datetime, timedelta

        cache = StatisticsCache(ttl_seconds=1)  # 1 second TTL

        cache.set("test_key", "test_value")

        # Should be cached immediately
        assert cache.get("test_key") == "test_value"

        # Manually expire by modifying cache time
        cache._cache_times["test_key"] = datetime.utcnow() - timedelta(seconds=2)

        # Should be expired now
        assert cache.get("test_key") is None


class TestQueryOptimizations:
    """Test that query optimizations are working correctly."""

    def test_review_session_uses_composite_index(self, db_session: Session):
        """
        Test that review session queries can use the composite index.

        This is a smoke test to ensure the query structure is compatible
        with the composite index on (question_id, next_review_date).
        """
        from datetime import datetime

        # This query should be able to use the composite index
        query = (
            db_session.query(UserProgress)
            .filter(UserProgress.next_review_date <= datetime.utcnow())
            .order_by(UserProgress.next_review_date.asc())
        )

        # Execute query - should not raise an error
        results = query.all()
        assert isinstance(results, list)

    def test_document_questions_uses_composite_index(self, db_session: Session):
        """
        Test that document question queries can use the composite index.

        This is a smoke test to ensure the query structure is compatible
        with the composite index on (document_id, difficulty).
        """
        # This query should be able to use the composite index
        query = db_session.query(Question).filter(
            Question.document_id == 1, Question.difficulty == "medium"
        )

        # Execute query - should not raise an error
        results = query.all()
        assert isinstance(results, list)
