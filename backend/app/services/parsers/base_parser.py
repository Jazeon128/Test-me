from abc import ABC, abstractmethod
from typing import List, Dict, Optional
from dataclasses import dataclass


@dataclass
class ParsedSection:
    """Represents a section of parsed content with reference information"""

    text: str
    page: Optional[int] = None  # For PDFs and DOCX
    section: Optional[str] = None  # For HTML and Markdown (heading)
    paragraph: Optional[int] = None
    start_char: int = 0
    end_char: int = 0


@dataclass
class ParsedDocument:
    """Container for parsed document content"""

    full_text: str
    sections: List[ParsedSection]
    title: Optional[str] = None
    num_pages: Optional[int] = None
    metadata: Dict = None

    def __post_init__(self):
        if self.metadata is None:
            self.metadata = {}


class BaseParser(ABC):
    """Base class for document parsers"""

    @abstractmethod
    def parse(self, file_path: str) -> ParsedDocument:
        """
        Parse a document and return structured content

        Args:
            file_path: Path to the document file

        Returns:
            ParsedDocument with extracted content and references
        """
        pass

    def _clean_text(self, text: str) -> str:
        """Clean and normalize text"""
        # Remove excessive whitespace
        text = " ".join(text.split())
        return text.strip()
