from bs4 import BeautifulSoup
from typing import List
from .base_parser import BaseParser, ParsedDocument, ParsedSection


class HTMLParser(BaseParser):
    """Parser for HTML documents"""

    def parse(self, file_path: str) -> ParsedDocument:
        """Parse HTML and extract text with section references"""
        sections: List[ParsedSection] = []
        full_text = ""
        title = None

        try:
            with open(file_path, "r", encoding="utf-8") as f:
                html_content = f.read()

            soup = BeautifulSoup(html_content, "lxml")

            # Extract title
            title_tag = soup.find("title")
            if title_tag:
                title = title_tag.get_text().strip()

            # Remove script and style elements
            for script in soup(["script", "style"]):
                script.decompose()

            char_offset = 0
            current_section = None

            # Process content with section tracking
            for element in soup.find_all(["h1", "h2", "h3", "h4", "h5", "h6", "p", "li", "div"]):
                # Track section headings
                if element.name in ["h1", "h2", "h3", "h4", "h5", "h6"]:
                    current_section = element.get_text().strip()
                    continue

                # Extract paragraph text
                text = element.get_text().strip()
                text = self._clean_text(text)

                if len(text) > 20:  # Skip very short paragraphs
                    start_char = char_offset
                    end_char = char_offset + len(text)

                    section = ParsedSection(
                        text=text,
                        section=current_section,
                        start_char=start_char,
                        end_char=end_char,
                    )
                    sections.append(section)

                    full_text += text + " "
                    char_offset = len(full_text)

        except Exception as e:
            raise ValueError(f"Failed to parse HTML: {str(e)}")

        return ParsedDocument(
            full_text=full_text.strip(),
            sections=sections,
            title=title,
            metadata={"parser": "html"},
        )
