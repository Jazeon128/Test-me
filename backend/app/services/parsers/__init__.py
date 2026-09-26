from .pdf_parser import PDFParser
from .html_parser import HTMLParser
from .markdown_parser import MarkdownParser
from .docx_parser import DOCXParser
from .youtube import YouTubeParser
from .powerpoint import PowerPointParser
from .base_parser import BaseParser, ParsedDocument, ParsedSection


def get_parser_for_type(file_type) -> BaseParser:
    """Return the parser for a DocumentType.

    Imported lazily to keep this package free of a circular import back into
    app.models.
    """
    from ...models.document import DocumentType

    parsers = {
        DocumentType.PDF: PDFParser(),
        DocumentType.HTML: HTMLParser(),
        DocumentType.MARKDOWN: MarkdownParser(),
        DocumentType.DOCX: DOCXParser(),
        DocumentType.PPTX: PowerPointParser(),
        DocumentType.YOUTUBE: YouTubeParser(),
    }

    parser = parsers.get(file_type)
    if parser is None:
        raise ValueError(f"No parser for document type: {file_type}")
    return parser


__all__ = [
    "BaseParser",
    "ParsedSection",
    "get_parser_for_type",
    "PDFParser",
    "HTMLParser",
    "MarkdownParser",
    "DOCXParser",
    "YouTubeParser",
    "PowerPointParser",
    "ParsedDocument",
]
