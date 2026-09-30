from sqlalchemy import Column, Integer, String, ForeignKey, JSON
from sqlalchemy.orm import backref, relationship
from .base import Base, TimestampMixin


class Deck(Base, TimestampMixin):
    """Represents a collection of questions forming a deck"""

    __tablename__ = "decks"

    id = Column(Integer, primary_key=True, index=True)
    notebook_id = Column(Integer, ForeignKey("notebooks.id"), nullable=True, index=True)
    kind = Column(String(20), nullable=False, default="quiz", server_default="quiz")
    source_ids = Column(JSON, nullable=True)
    name = Column(String(255), nullable=False)
    description = Column(String(1000), nullable=True)

    # Relationships
    notebook = relationship("Notebook", back_populates="decks")
    deck_questions = relationship(
        "DeckQuestion", back_populates="deck", cascade="all, delete-orphan"
    )

    @property
    def questions(self):
        """Get questions through DeckQuestion association"""
        return [dq.question for dq in sorted(self.deck_questions, key=lambda x: x.order)]

    @questions.setter
    def questions(self, question_list):
        """Set questions through DeckQuestion association"""
        # Clear existing associations
        self.deck_questions.clear()
        # Add new associations with order
        for idx, question in enumerate(question_list):
            # Get question ID - handle both Question objects and integer IDs
            question_id = question.id if hasattr(question, "id") else question
            deck_question = DeckQuestion(question_id=question_id, order=idx)
            # SQLAlchemy will set deck_id automatically when deck is saved
            self.deck_questions.append(deck_question)

    def __repr__(self):
        return f"<Deck {self.id}: {self.name}>"


class DeckQuestion(Base):
    """Through model for deck-question relationship with ordering"""

    __tablename__ = "deck_questions"

    deck_id = Column(Integer, ForeignKey("decks.id"), primary_key=True)
    question_id = Column(Integer, ForeignKey("questions.id"), primary_key=True)
    order = Column(Integer, nullable=False)

    # Relationships
    deck = relationship("Deck", back_populates="deck_questions")
    question = relationship("Question", backref=backref("deck_questions", cascade="all, delete-orphan"))
