from sqlalchemy import Column, Integer, String, ForeignKey, Table
from sqlalchemy.orm import relationship
from .base import Base, TimestampMixin


# Association table for many-to-many relationship
test_questions = Table(
    'test_questions',
    Base.metadata,
    Column('test_id', Integer, ForeignKey('tests.id'), primary_key=True),
    Column('question_id', Integer, ForeignKey('questions.id'), primary_key=True),
    Column('order', Integer, nullable=False)  # Order of questions in test
)


class Test(Base, TimestampMixin):
    """Represents a collection of questions forming a test"""

    __tablename__ = "tests"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    description = Column(String(1000), nullable=True)

    # Relationships
    questions = relationship("Question", secondary=test_questions, backref="tests")

    def __repr__(self):
        return f"<Test {self.id}: {self.name}>"


class TestQuestion(Base):
    """Through model for test-question relationship with ordering"""

    __tablename__ = "test_questions"

    test_id = Column(Integer, ForeignKey('tests.id'), primary_key=True)
    question_id = Column(Integer, ForeignKey('questions.id'), primary_key=True)
    order = Column(Integer, nullable=False)
