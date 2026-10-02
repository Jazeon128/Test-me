from sqlalchemy import Column, Integer, String, Text, ForeignKey, Boolean, JSON, Index
from sqlalchemy.orm import backref, relationship
from .base import Base, TimestampMixin


class Question(Base, TimestampMixin):
    """Represents a multiple-choice question or a front-and-back flashcard"""

    __tablename__ = "questions"

    # Declared on the model, not only in the migration: init_db() builds tables
    # with create_all(), so an index that lives only in Alembic never reaches a
    # fresh database. Serves the per-document, per-difficulty question query.
    __table_args__ = (Index("idx_questions_document_difficulty", "document_id", "difficulty"),)

    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey("documents.id"), nullable=True)

    # Question content
    card_type = Column(String(20), nullable=False, default="mcq", server_default="mcq")
    question_text = Column(Text, nullable=False)
    explanation = Column(Text, nullable=True)  # Why the answer is correct

    # Source reference
    source_reference = Column(JSON, nullable=True)  # {"page": 5, "paragraph": 2, "text": "..."}
    difficulty = Column(String(20), default="medium")  # easy, medium, hard

    # Relationships
    document = relationship("Document", backref=backref("questions", cascade="all, delete-orphan"))
    options = relationship(
        "QuestionOption", back_populates="question", cascade="all, delete-orphan"
    )
    tags = relationship("Tag", secondary="question_tags", back_populates="questions")

    def __repr__(self) -> str:
        return f"<Question {self.id}: {self.question_text[:50]}>"


class QuestionOption(Base, TimestampMixin):
    """Represents an answer option for a multiple-choice question"""

    __tablename__ = "question_options"

    id = Column(Integer, primary_key=True, index=True)
    question_id = Column(Integer, ForeignKey("questions.id"), nullable=False)

    option_text = Column(Text, nullable=False)
    is_correct = Column(Boolean, default=False, nullable=False)
    order = Column(Integer, nullable=False)  # Display order (0-3 for 4 options)

    # Relationships
    question = relationship("Question", back_populates="options")

    def __repr__(self) -> str:
        return f"<QuestionOption {self.id}: {self.option_text[:30]} ({'✓' if self.is_correct else '✗'})>"
