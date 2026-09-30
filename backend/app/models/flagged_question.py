from sqlalchemy import Column, Integer, String, DateTime, JSON, ForeignKey
from sqlalchemy.sql import func
from .base import Base


class FlaggedQuestion(Base):
    __tablename__ = "flagged_questions"

    id = Column(Integer, primary_key=True)
    deck_id = Column(Integer, ForeignKey("decks.id"), index=True, nullable=True)
    document_id = Column(Integer, ForeignKey("documents.id"), nullable=True)
    job_id = Column(String(100), nullable=True)
    payload = Column(JSON, nullable=False)
    reasons = Column(JSON, nullable=False)
    status = Column(String(20), default="pending")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    resolved_at = Column(DateTime(timezone=True), nullable=True)
