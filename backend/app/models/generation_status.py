from sqlalchemy import Column, Integer, String, Text, DateTime, JSON
from sqlalchemy.sql import func
from .base import Base


class GenerationStatus(Base):
    """Track status of question generation jobs"""

    __tablename__ = "generation_status"

    id = Column(Integer, primary_key=True, index=True)
    job_id = Column(String(100), unique=True, index=True, nullable=False)
    deck_id = Column(Integer, nullable=True)
    # pending, awaiting_confirmation, needs_choice, processing, completed, failed, cancelled
    status = Column(String(30), default="pending")
    progress = Column(Integer, default=0)  # 0-100
    current_step = Column(String(200), default="")
    logs = Column(JSON, default=list)  # List of log messages with timestamps
    error_message = Column(Text, nullable=True)

    # For awaiting_confirmation: the stored upload request to generate.
    # For needs_choice: the routing_log_id holding this canvas job's choices.
    pending_request = Column(JSON, nullable=True)

    # Metadata
    total_documents = Column(Integer, default=0)
    documents_completed = Column(Integer, default=0)
    documents_failed = Column(Integer, default=0)
    total_questions_requested = Column(Integer, default=0)
    total_questions_generated = Column(Integer, default=0)
    total_questions_flagged = Column(Integer, default=0)

    # Progress tracking fields
    current_question = Column(Integer, default=0)
    total_questions = Column(Integer, default=0)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    started_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)

    def add_log(self, message: str, level: str = "info") -> None:
        """Add a log message with timestamp"""
        import datetime

        if self.logs is None:
            self.logs = []

        log_entry = {
            "timestamp": datetime.datetime.now().isoformat(),
            "level": level,
            "message": message,
        }
        self.logs.append(log_entry)

    def to_dict(self) -> dict:  # type: ignore[type-arg]  # noqa
        """Convert to dictionary for API response"""
        return {
            "job_id": self.job_id,
            "deck_id": self.deck_id,
            "status": self.status,
            "progress": self.progress,
            "current_step": self.current_step,
            "logs": self.logs or [],
            "error_message": self.error_message,
            "total_documents": self.total_documents,
            "documents_completed": self.documents_completed,
            "documents_failed": self.documents_failed,
            "total_questions_requested": self.total_questions_requested,
            "total_questions_generated": self.total_questions_generated,
            "total_questions_flagged": self.total_questions_flagged,
            "current_question": self.current_question,
            "total_questions": self.total_questions,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "started_at": self.started_at.isoformat() if self.started_at else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
        }
