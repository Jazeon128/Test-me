import re
from typing import List
from .base_parser import BaseParser, ParsedDocument, ParsedSection


class MarkdownParser(BaseParser):
    """Parser for Markdown documents"""

    def parse(self, file_path: str) -> ParsedDocument:
        """Parse Markdown and extract text with section references"""
        sections: List[ParsedSection] = []
        full_text = ""
        title = None

        try:
            with open(file_path, "r", encoding="utf-8") as f:
                content = f.read()

            lines = content.split("\n")
            current_section = None
            char_offset = 0
            paragraph_buffer = []

            for line in lines:
                line = line.strip()

                # Check for headings
                heading_match = re.match(r"^(#{1,6})\s+(.+)", line)
                if heading_match:
                    # Save previous paragraph if exists
                    if paragraph_buffer:
                        text = " ".join(paragraph_buffer)
                        text = self._clean_text(text)

                        if len(text) > 20:
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

                        paragraph_buffer = []

                    # Update current section
                    current_section = heading_match.group(2)

                    # Use first h1 as title if not set
                    if title is None and heading_match.group(1) == "#":
                        title = current_section

                    continue

                # Skip empty lines (end of paragraph)
                if not line:
                    if paragraph_buffer:
                        text = " ".join(paragraph_buffer)
                        text = self._clean_text(text)

                        if len(text) > 20:
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

                        paragraph_buffer = []
                    continue

                # Accumulate paragraph lines
                # Remove markdown formatting
                line = re.sub(r"\*\*(.+?)\*\*", r"\1", line)  # Bold
                line = re.sub(r"\*(.+?)\*", r"\1", line)  # Italic
                line = re.sub(r"`(.+?)`", r"\1", line)  # Code
                line = re.sub(r"\[(.+?)\]\(.+?\)", r"\1", line)  # Links

                paragraph_buffer.append(line)

            # Process final paragraph
            if paragraph_buffer:
                text = " ".join(paragraph_buffer)
                text = self._clean_text(text)

                if len(text) > 20:
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

        except Exception as e:
            raise ValueError(f"Failed to parse Markdown: {str(e)}")

        return ParsedDocument(
            full_text=full_text.strip(),
            sections=sections,
            title=title,
            metadata={"parser": "markdown"},
        )
