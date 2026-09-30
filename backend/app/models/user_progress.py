from sqlalchemy import Column, Integer, Float, DateTime, ForeignKey, Boolean, JSON, Index
from sqlalchemy.orm import backref, relationship
from datetime import datetime
from .base import Base, TimestampMixin


class UserProgress(Base, TimestampMixin):
    """
    Tracks user progress for spaced repetition (SM-2 algorithm like Anki)
    """

    __tablename__ = "user_progress"

    # Declared on the model, not only in the migration: init_db() builds tables
    # with create_all(), so an index that lives only in Alembic never reaches a
    # fresh database. Serves the due-review query in sm2_algorithm.
    __table_args__ = (
        Index("idx_user_progress_question_review", "question_id", "next_review_date"),
    )

    id = Column(Integer, primary_key=True, index=True)
    question_id = Column(Integer, ForeignKey("questions.id"), nullable=False)

    # Spaced Repetition (SM-2 Algorithm)
    easiness_factor = Column(Float, default=2.5, nullable=False)  # E-Factor (1.3 - 2.5+)
    interval = Column(Integer, default=0, nullable=False)  # Days until next review
    repetitions = Column(Integer, default=0, nullable=False)  # Consecutive correct answers
    next_review_date = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Performance Metrics
    times_seen = Column(Integer, default=0, nullable=False)
    times_correct = Column(Integer, default=0, nullable=False)
    times_incorrect = Column(Integer, default=0, nullable=False)
    average_time_seconds = Column(Float, default=0.0, nullable=False)

    # Gamification
    streak = Column(Integer, default=0, nullable=False)  # Current correct streak
    best_streak = Column(Integer, default=0, nullable=False)
    is_mastered = Column(Boolean, default=False, nullable=False)  # Answered correctly 5+ times

    # Last attempt details
    last_attempt_date = Column(DateTime, nullable=True)
    last_attempt_correct = Column(Boolean, nullable=True)
    last_attempt_time_seconds = Column(Float, nullable=True)

    # History (for analytics)
    attempt_history = Column(JSON, nullable=True)  # List of {date, correct, time_seconds, quality}

    # Relationships
    question = relationship("Question", backref=backref("user_progress", cascade="all, delete-orphan"))

    def __repr__(self):
        return f"<UserProgress Q{self.question_id}: EF={self.easiness_factor:.2f}, Interval={self.interval}>"
