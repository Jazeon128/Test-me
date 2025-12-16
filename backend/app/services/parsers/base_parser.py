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
    metadata: Optional[Dict] = None

    def __post_init__(self) -> None:
        if self.metadata is None:
            self.metadata = {}


class BaseParser(ABC):
    """
    Base class for document parsers.
    
    This abstract base class defines the interface that all document parsers must implement.
    Parsers are responsible for extracting text content from various document formats
    (PDF, DOCX, HTML, Markdown, etc.) and structuring it into sections with reference
    information for question generation.
    
    Parser Responsibilities:
    ------------------------
    1. Extract text content from the document
    2. Divide content into logical sections (pages, headings, paragraphs)
    3. Preserve reference information (page numbers, section titles, character positions)
    4. Clean and normalize text (remove excessive whitespace, special characters)
    5. Extract metadata (title, page count, etc.)
    
    Section Division Strategy:
    --------------------------
    Parsers should divide documents into sections that are:
    - Self-contained: Each section should have enough context for question generation
    - Appropriately sized: Typically 200-1000 characters per section
    - Logically organized: Follow document structure (chapters, sections, pages)
    
    Supported Document Types:
    -------------------------
    - PDF: Uses PyPDF2 or pdfplumber for text extraction
    - DOCX: Uses python-docx for Word documents
    - HTML: Uses BeautifulSoup for web content
    - Markdown: Uses regex parsing for markdown files
    - PPTX: Uses python-pptx for PowerPoint presentations
    - YouTube: Uses youtube-transcript-api for video transcripts
    
    Example Implementation:
    -----------------------
    ```python
    from app.services.parsers.base_parser import BaseParser, ParsedDocument, ParsedSection
    
    class CustomParser(BaseParser):
        def parse(self, file_path: str) -> ParsedDocument:
            # Read file content
            with open(file_path, 'r') as f:
                content = f.read()
            
            # Create sections
            sections = []
            paragraphs = content.split('\\n\\n')
            
            for i, para in enumerate(paragraphs):
                section = ParsedSection(
                    text=self._clean_text(para),
                    paragraph=i,
                    start_char=content.index(para),
                    end_char=content.index(para) + len(para)
                )
                sections.append(section)
            
            return ParsedDocument(
                full_text=content,
                sections=sections,
                title="Custom Document"
            )
    ```
    
    Notes:
    ------
    - Parsers should handle encoding issues gracefully
    - Empty or whitespace-only sections should be filtered out
    - Reference information helps users trace questions back to source material
    """

    @abstractmethod
    def parse(self, file_path: str) -> ParsedDocument:
        """
        Parse a document and return structured content.
        
        This method must be implemented by all parser subclasses. It should:
        1. Read the document from the file path
        2. Extract all text content
        3. Divide content into logical sections
        4. Preserve reference information (pages, sections, positions)
        5. Return a ParsedDocument with all extracted data

        Args:
            file_path: Absolute or relative path to the document file.
                The file must exist and be readable.

        Returns:
            ParsedDocument containing:
            - full_text: Complete document text
            - sections: List of ParsedSection objects with text and references
            - title: Document title (if available)
            - num_pages: Page count (for paginated documents)
            - metadata: Additional document metadata
            
        Raises:
            FileNotFoundError: If the file doesn't exist
            PermissionError: If the file can't be read
            ValueError: If the file format is invalid or corrupted
            
        Example:
            >>> parser = PDFParser()
            >>> doc = parser.parse("study_guide.pdf")
            >>> print(f"Extracted {len(doc.sections)} sections")
            >>> print(f"Total text length: {len(doc.full_text)} characters")
        """
        pass

    def _clean_text(self, text: str) -> str:
        """
        Clean and normalize text content.
        
        This utility method removes excessive whitespace and normalizes text formatting.
        It's used internally by parsers to ensure consistent text quality.
        
        Cleaning Operations:
        --------------------
        - Collapses multiple spaces into single spaces
        - Removes leading and trailing whitespace
        - Normalizes line breaks
        - Preserves sentence structure
        
        Args:
            text: Raw text string to clean
            
        Returns:
            Cleaned and normalized text string
            
        Example:
            >>> parser = PDFParser()
            >>> raw = "Hello    world\\n\\n\\n   How are you?  "
            >>> clean = parser._clean_text(raw)
            >>> print(clean)
            "Hello world How are you?"
        """
        # Remove excessive whitespace
        text = " ".join(text.split())
        return text.strip()
