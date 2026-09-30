from docx import Document
from docx.oxml.ns import qn
from docx.table import Table
from docx.text.paragraph import Paragraph
from typing import List
from .base_parser import BaseParser, ParsedDocument, ParsedSection


class DOCXParser(BaseParser):
    """Parser for DOCX documents"""

    def _body_text(self, doc):
        """Yield paragraphs and table rows in document order."""
        for element in doc.element.body:
            if element.tag == qn("w:p"):
                para = Paragraph(element, doc)
                style = para.style.name
                text = para.text.strip() if style.startswith("Heading") else self._clean_text(para.text)
                if text and (style.startswith("Heading") or len(text) > 20):
                    yield text, style
            elif element.tag == qn("w:tbl"):
                for row in Table(element, doc).rows:
                    cells = [self._clean_text(cell.text) for cell in row.cells]
                    if any(cells):
                        yield " | ".join(cells), None

    def parse(self, file_path: str) -> ParsedDocument:
        """Parse DOCX and extract text with section references"""
        sections: List[ParsedSection] = []
        full_text = ""
        title = None
        current_section = None

        try:
            doc = Document(file_path)

            # Try to extract title from document properties
            if doc.core_properties.title:
                title = doc.core_properties.title

            char_offset = 0
            paragraph_num = 0

            for text, style in self._body_text(doc):
                # Check if this is a heading
                if style and style.startswith("Heading"):
                    current_section = text
                    if title is None and style == "Heading 1":
                        title = text
                    continue

                paragraph_num += 1
                start_char = char_offset
                end_char = char_offset + len(text)

                section = ParsedSection(
                    text=text,
                    section=current_section,
                    paragraph=paragraph_num,
                    start_char=start_char,
                    end_char=end_char,
                )
                sections.append(section)

                full_text += text + " "
                char_offset = len(full_text)

            # Count pages (approximate - DOCX doesn't have direct page count)
            # We'll estimate based on word count
            word_count = len(full_text.split())
            num_pages = max(1, word_count // 250)  # ~250 words per page

        except Exception as e:
            raise ValueError(f"Failed to parse DOCX: {str(e)}")

        return ParsedDocument(
            full_text=full_text.strip(),
            sections=sections,
            title=title,
            num_pages=num_pages,
            metadata={"parser": "docx"},
        )
