import pdfplumber
from typing import List
from .base_parser import BaseParser, ParsedDocument, ParsedSection


class PDFParser(BaseParser):
    """Parser for PDF documents"""

    def parse(self, file_path: str) -> ParsedDocument:
        """Parse PDF and extract text with page references"""
        sections: List[ParsedSection] = []
        full_text = ""
        num_pages = 0
        title = None

        try:
            with pdfplumber.open(file_path) as pdf:
                num_pages = len(pdf.pages)

                # Try to extract title from metadata
                if pdf.metadata:
                    title = pdf.metadata.get("Title") or pdf.metadata.get("title")

                char_offset = 0
                for page_num, page in enumerate(pdf.pages, start=1):
                    page_text = page.extract_text()

                    if page_text:
                        page_text = self._clean_text(page_text)

                        # Split into paragraphs (double newline or significant whitespace)
                        paragraphs = [p.strip() for p in page_text.split("\n\n") if p.strip()]

                        for para_num, paragraph in enumerate(paragraphs, start=1):
                            if len(paragraph) > 20:  # Skip very short paragraphs
                                start_char = char_offset
                                end_char = char_offset + len(paragraph)

                                section = ParsedSection(
                                    text=paragraph,
                                    page=page_num,
                                    paragraph=para_num,
                                    start_char=start_char,
                                    end_char=end_char,
                                )
                                sections.append(section)

                                full_text += paragraph + " "
                                char_offset = len(full_text)

        except Exception as e:
            raise ValueError(f"Failed to parse PDF: {str(e)}")

        return ParsedDocument(
            full_text=full_text.strip(),
            sections=sections,
            title=title,
            num_pages=num_pages,
            metadata={"parser": "pdf"},
        )
