from sqlalchemy import Column, Integer, String, Text, Enum
from .base import Base, TimestampMixin
import enum


class DocumentType(enum.Enum):
    PDF = "pdf"
    HTML = "html"
    MARKDOWN = "markdown"
    DOCX = "docx"


class Document(Base, TimestampMixin):
    """Represents an uploaded document"""

    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String(255), nullable=False)
    original_filename = Column(String(255), nullable=False)
    file_type = Column(Enum(DocumentType), nullable=False)
    file_path = Column(String(512), nullable=False)
    file_size = Column(Integer, nullable=False)  # in bytes

    # Extracted content
    content = Column(Text, nullable=True)  # Full text content
    content_hash = Column(String(64), nullable=True)  # SHA-256 hash

    # Metadata
    title = Column(String(512), nullable=True)
    num_pages = Column(Integer, nullable=True)  # For PDFs and DOCX

    def __repr__(self):
        return f"<Document {self.id}: {self.original_filename}>"
