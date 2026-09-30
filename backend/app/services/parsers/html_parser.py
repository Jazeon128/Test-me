from bs4 import BeautifulSoup, Comment, NavigableString
from itertools import groupby
from typing import List
from .base_parser import BaseParser, ParsedDocument, ParsedSection


class HTMLParser(BaseParser):
    """Parser for HTML documents"""

    HEADINGS = {"h1", "h2", "h3", "h4", "h5", "h6"}
    BLOCKS = HEADINGS | {
        "p", "li", "div", "td", "th", "section", "article", "main",
        "blockquote", "pre", "dd", "dt", "figcaption", "body",
    }
    EXCLUDED = {
        "script", "style", "noscript", "template", "nav", "header", "footer", "aside",
    }

    def _owned_text(self, soup):
        """Assign each text node to its closest text block exactly once."""
        for node in soup.descendants:
            if not isinstance(node, NavigableString) or isinstance(node, Comment):
                continue
            owner = node.find_parent(self.BLOCKS)
            if owner is not None:
                yield owner, str(node)

    def _text_blocks(self, soup):
        # Contiguous runs preserve ordering around nested blocks and headings.
        for _, nodes in groupby(self._owned_text(soup), key=lambda item: id(item[0])):
            parts = list(nodes)
            yield parts[0][0].name, self._clean_text("".join(text for _, text in parts))

    def parse(self, file_path: str) -> ParsedDocument:
        """Parse HTML and extract text with section references"""
        sections: List[ParsedSection] = []
        full_text = ""
        title = None

        try:
            with open(file_path, "rb") as f:
                html_content = f.read()

            soup = BeautifulSoup(html_content, "lxml")

            # Extract title
            title_tag = soup.find("title")
            if title_tag:
                title = title_tag.get_text().strip()

            # Remove non-study content before assigning text to its closest owner.
            for element in soup(self.EXCLUDED):
                element.decompose()

            char_offset = 0
            current_section = None

            # Process content with section tracking
            for name, text in self._text_blocks(soup):
                # Track section headings
                if name in self.HEADINGS:
                    current_section = text
                    continue

                if len(text) > 20:  # Skip very short non-heading blocks.
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
