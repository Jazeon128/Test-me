from sqlalchemy import Column, Integer, String, Text, Enum, ForeignKey, JSON, DateTime
from sqlalchemy.orm import relationship

from .base import Base, TimestampMixin
import enum


class DocumentType(enum.Enum):
    PDF = "pdf"
    HTML = "html"
    MARKDOWN = "markdown"
    DOCX = "docx"
    PPTX = "pptx"
    YOUTUBE = "youtube"


class Document(Base, TimestampMixin):
    """Represents an uploaded document"""

    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, index=True)
    notebook_id = Column(Integer, ForeignKey("notebooks.id"), nullable=True, index=True)
    filename = Column(String(255), nullable=False)
    original_filename = Column(String(255), nullable=False)
    file_type: Column = Column(Enum(DocumentType), nullable=False)
    file_path = Column(String(512), nullable=False)
    file_size = Column(Integer, nullable=False)  # in bytes

    # Extracted content
    content = Column(Text, nullable=True)  # Full text content
    content_hash = Column(String(64), nullable=True)  # SHA-256 hash

    # Metadata
    title = Column(String(512), nullable=True)
    num_pages = Column(Integer, nullable=True)  # For PDFs and DOCX
    status = Column(String(20), nullable=False, default="processing", server_default="ready")
    error_message = Column(Text, nullable=True)
    preflight = Column(JSON, nullable=True)
    parsed_at = Column(DateTime, nullable=True)

    passages = relationship(
        "DocumentPassage", back_populates="document", order_by="DocumentPassage.ordinal",
        cascade="all, delete-orphan",
    )

    notebook = relationship("Notebook", back_populates="documents")

    def __repr__(self):
        return f"<Document {self.id}: {self.original_filename}>"
