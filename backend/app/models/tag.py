from sqlalchemy import Column, String, Integer, Table, ForeignKey, Index
from sqlalchemy.orm import relationship
from .base import Base

# Association table for Question-Tag many-to-many relationship
question_tags = Table(
    "question_tags",
    Base.metadata,
    Column("question_id", Integer, ForeignKey("questions.id"), primary_key=True),
    Column("tag_id", Integer, ForeignKey("tags.id"), primary_key=True),
)


class Tag(Base):
    __tablename__ = "tags"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    notebook_id = Column(Integer, ForeignKey("notebooks.id"), nullable=True, index=True)

    __table_args__ = (
        Index("ix_tags_notebook_name", "notebook_id", "name", unique=True),
        Index("ix_tags_shared_name", "name", unique=True, sqlite_where=notebook_id.is_(None)),
    )
    color = Column(String, default="blue")  # For UI display

    @property
    def shared(self):
        return self.notebook_id is None

    # Relationships
    questions = relationship("Question", secondary=question_tags, back_populates="tags")
