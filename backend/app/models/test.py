from sqlalchemy import Column, Integer, String, ForeignKey
from sqlalchemy.orm import relationship
from .base import Base, TimestampMixin


class Test(Base, TimestampMixin):
    """Represents a collection of questions forming a test"""

    __tablename__ = "tests"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    description = Column(String(1000), nullable=True)

    # Relationships
    test_questions = relationship("TestQuestion", back_populates="test", cascade="all, delete-orphan")
    
    @property
    def questions(self):
        """Get questions through TestQuestion association"""
        return [tq.question for tq in sorted(self.test_questions, key=lambda x: x.order)]
    
    @questions.setter
    def questions(self, question_list):
        """Set questions through TestQuestion association"""
        # Clear existing associations
        self.test_questions.clear()
        # Add new associations with order
        for idx, question in enumerate(question_list):
            # Get question ID - handle both Question objects and integer IDs
            question_id = question.id if hasattr(question, 'id') else question
            test_question = TestQuestion(
                question_id=question_id,
                order=idx
            )
            # SQLAlchemy will set test_id automatically when test is saved
            self.test_questions.append(test_question)

    def __repr__(self):
        return f"<Test {self.id}: {self.name}>"


class TestQuestion(Base):
    """Through model for test-question relationship with ordering"""

    __tablename__ = "test_questions"

    test_id = Column(Integer, ForeignKey('tests.id'), primary_key=True)
    question_id = Column(Integer, ForeignKey('questions.id'), primary_key=True)
    order = Column(Integer, nullable=False)
    
    # Relationships
    test = relationship("Test", back_populates="test_questions")
    question = relationship("Question", backref="test_questions")
