"""Unit tests for document parsers"""
import pytest
from pathlib import Path

from app.services.parsers.base_parser import ParsedDocument, ParsedSection
from app.services.parsers.markdown_parser import MarkdownParser
from app.services.parsers.html_parser import HTMLParser


@pytest.fixture
def temp_markdown_file(tmp_path):
    """Create a temporary markdown file for testing"""
    content = """# Test Document

This is the introduction paragraph. It contains some basic information about the topic.

## Section One

This is the first section with detailed content. Python is a high-level programming language.

It has multiple paragraphs to test the parser.

## Section Two

This is the second section. **Bold text** and *italic text* should be cleaned.

Links like [example](http://example.com) should show only the text.

### Subsection

Nested sections should also work properly.
"""
    file_path = tmp_path / "test.md"
    file_path.write_text(content, encoding="utf-8")
    return str(file_path)


@pytest.fixture
def temp_html_file(tmp_path):
    """Create a temporary HTML file for testing"""
    content = """<!DOCTYPE html>
<html>
<head>
    <title>Test HTML Document</title>
</head>
<body>
    <h1>Main Heading</h1>
    <p>This is the introduction paragraph with some content.</p>

    <h2>First Section</h2>
    <p>This section contains information about cloud computing.</p>
    <p>Multiple paragraphs should be handled correctly.</p>

    <h2>Second Section</h2>
    <p>This section has <strong>bold</strong> and <em>italic</em> text.</p>

    <div>
        <p>Content in a div should also be extracted.</p>
    </div>
</body>
</html>
"""
    file_path = tmp_path / "test.html"
    file_path.write_text(content, encoding="utf-8")
    return str(file_path)


@pytest.fixture
def temp_short_markdown_file(tmp_path):
    """Create a short markdown file with minimal content"""
    content = """# Title

Short content."""
    file_path = tmp_path / "short.md"
    file_path.write_text(content, encoding="utf-8")
    return str(file_path)


@pytest.mark.unit
class TestParsedSection:
    """Tests for ParsedSection dataclass"""

    def test_creation_all_fields(self):
        """Test creating ParsedSection with all fields"""
        section = ParsedSection(
            text="Sample text",
            page=1,
            section="Introduction",
            paragraph=1,
            start_char=0,
            end_char=11
        )

        assert section.text == "Sample text"
        assert section.page == 1
        assert section.section == "Introduction"
        assert section.paragraph == 1
        assert section.start_char == 0
        assert section.end_char == 11

    def test_creation_minimal_fields(self):
        """Test creating ParsedSection with minimal fields"""
        section = ParsedSection(text="Test")

        assert section.text == "Test"
        assert section.page is None
        assert section.section is None
        assert section.start_char == 0
        assert section.end_char == 0


@pytest.mark.unit
class TestParsedDocument:
    """Tests for ParsedDocument dataclass"""

    def test_creation_full(self):
        """Test creating ParsedDocument with all fields"""
        sections = [
            ParsedSection(text="Section 1"),
            ParsedSection(text="Section 2")
        ]

        doc = ParsedDocument(
            full_text="Full document text",
            sections=sections,
            title="Test Document",
            num_pages=5,
            metadata={"author": "Test"}
        )

        assert doc.full_text == "Full document text"
        assert len(doc.sections) == 2
        assert doc.title == "Test Document"
        assert doc.num_pages == 5
        assert doc.metadata["author"] == "Test"

    def test_metadata_auto_initialization(self):
        """Test that metadata is auto-initialized to empty dict"""
        doc = ParsedDocument(
            full_text="test",
            sections=[]
        )

        assert doc.metadata == {}


@pytest.mark.unit
class TestMarkdownParser:
    """Tests for MarkdownParser"""

    def test_parse_basic_markdown(self, temp_markdown_file):
        """Test parsing a basic markdown file"""
        parser = MarkdownParser()
        result = parser.parse(temp_markdown_file)

        assert isinstance(result, ParsedDocument)
        assert len(result.sections) > 0
        assert result.title == "Test Document"
        assert "Python" in result.full_text

    def test_parse_sections_extraction(self, temp_markdown_file):
        """Test that sections are properly extracted"""
        parser = MarkdownParser()
        result = parser.parse(temp_markdown_file)

        # Should have multiple sections
        assert len(result.sections) >= 3

        # Check section names
        section_names = [s.section for s in result.sections if s.section]
        assert any("Section One" in str(name) for name in section_names)
        assert any("Section Two" in str(name) for name in section_names)

    def test_parse_heading_levels(self, temp_markdown_file):
        """Test that different heading levels are recognized"""
        parser = MarkdownParser()
        result = parser.parse(temp_markdown_file)

        # H1 should be title
        assert result.title == "Test Document"

        # Sections should include H2 and H3
        sections_text = " ".join([s.section or "" for s in result.sections])
        assert "Section" in sections_text

    def test_parse_markdown_formatting_cleaned(self, temp_markdown_file):
        """Test that markdown formatting is removed"""
        parser = MarkdownParser()
        result = parser.parse(temp_markdown_file)

        # Bold and italic markers should be removed
        assert "**" not in result.full_text
        assert "*" not in result.full_text or "high-level" not in result.full_text

    def test_parse_links_cleaned(self, temp_markdown_file):
        """Test that links are converted to just text"""
        parser = MarkdownParser()
        result = parser.parse(temp_markdown_file)

        # Should have link text but not markdown link syntax
        assert "example" in result.full_text
        assert "[example]" not in result.full_text

    def test_parse_minimum_text_length(self, temp_short_markdown_file):
        """Test that very short sections are handled"""
        parser = MarkdownParser()
        result = parser.parse(temp_short_markdown_file)

        assert isinstance(result, ParsedDocument)
        # Short content might be filtered out based on 20 char minimum

    def test_parse_nonexistent_file(self):
        """Test error handling for nonexistent file"""
        parser = MarkdownParser()

        with pytest.raises(ValueError, match="Failed to parse"):
            parser.parse("/nonexistent/file.md")

    def test_parse_char_offsets(self, temp_markdown_file):
        """Test that character offsets are correctly calculated"""
        parser = MarkdownParser()
        result = parser.parse(temp_markdown_file)

        # Check that offsets are sequential and valid
        for section in result.sections:
            assert section.start_char >= 0
            assert section.end_char >= section.start_char
            # Text should match the offset range
            assert len(section.text) <= (section.end_char - section.start_char) + 100  # Some tolerance

    def test_clean_text_method(self):
        """Test the text cleaning utility method"""
        parser = MarkdownParser()

        # Test excessive whitespace removal
        dirty_text = "This   has   too    much    whitespace"
        clean = parser._clean_text(dirty_text)
        assert clean == "This has too much whitespace"

        # Test leading/trailing whitespace
        dirty_text = "  trimmed  "
        clean = parser._clean_text(dirty_text)
        assert clean == "trimmed"

    def test_parse_empty_file(self, tmp_path):
        """Test parsing an empty markdown file"""
        empty_file = tmp_path / "empty.md"
        empty_file.write_text("", encoding="utf-8")

        parser = MarkdownParser()
        result = parser.parse(str(empty_file))

        assert result.full_text == ""
        assert len(result.sections) == 0

    def test_parse_only_headings(self, tmp_path):
        """Test parsing file with only headings"""
        content = "# Heading 1\n## Heading 2\n### Heading 3"
        file_path = tmp_path / "headings.md"
        file_path.write_text(content, encoding="utf-8")

        parser = MarkdownParser()
        result = parser.parse(str(file_path))

        assert result.title == "Heading 1"
        # Should have minimal sections since there's no content


@pytest.mark.unit
class TestHTMLParser:
    """Tests for HTMLParser"""

    def test_parse_basic_html(self, temp_html_file):
        """Test parsing a basic HTML file"""
        parser = HTMLParser()
        result = parser.parse(temp_html_file)

        assert isinstance(result, ParsedDocument)
        assert len(result.sections) > 0
        assert result.title == "Test HTML Document"

    def test_parse_html_sections(self, temp_html_file):
        """Test that HTML sections are properly extracted"""
        parser = HTMLParser()
        result = parser.parse(temp_html_file)

        # Should extract content from paragraphs
        assert "cloud computing" in result.full_text.lower()
        assert "introduction" in result.full_text.lower()

    def test_parse_html_headings(self, temp_html_file):
        """Test that headings are used as section markers"""
        parser = HTMLParser()
        result = parser.parse(temp_html_file)

        # Check section names
        section_names = [s.section for s in result.sections if s.section]
        assert any("Main Heading" in str(name) or "First Section" in str(name) for name in section_names)

    def test_parse_html_formatting_cleaned(self, temp_html_file):
        """Test that HTML tags are removed"""
        parser = HTMLParser()
        result = parser.parse(temp_html_file)

        # Should not contain HTML tags
        assert "<p>" not in result.full_text
        assert "<strong>" not in result.full_text
        assert "<em>" not in result.full_text

        # Should contain the text content
        assert "bold" in result.full_text.lower()
        assert "italic" in result.full_text.lower()

    def test_parse_html_nested_elements(self, temp_html_file):
        """Test extraction from nested elements"""
        parser = HTMLParser()
        result = parser.parse(temp_html_file)

        # Content in div should be extracted
        assert "Content in a div" in result.full_text

    def test_parse_html_nonexistent_file(self):
        """Test error handling for nonexistent file"""
        parser = HTMLParser()

        with pytest.raises(ValueError, match="Failed to parse"):
            parser.parse("/nonexistent/file.html")

    def test_parse_malformed_html(self, tmp_path):
        """Test parsing malformed HTML"""
        content = "<html><body><p>Unclosed paragraph"
        file_path = tmp_path / "malformed.html"
        file_path.write_text(content, encoding="utf-8")

        parser = HTMLParser()
        # Should still parse without crashing
        result = parser.parse(str(file_path))

        assert isinstance(result, ParsedDocument)

    def test_parse_html_with_scripts_and_styles(self, tmp_path):
        """Test that scripts and styles are excluded"""
        content = """<html>
<head>
    <style>body { color: red; }</style>
    <script>alert('test');</script>
</head>
<body>
    <p>Actual content here that is long enough to be parsed by the HTML parser.</p>
</body>
</html>"""
        file_path = tmp_path / "with_scripts.html"
        file_path.write_text(content, encoding="utf-8")

        parser = HTMLParser()
        result = parser.parse(str(file_path))

        # Should have content but not scripts/styles
        assert "Actual content" in result.full_text
        assert "alert" not in result.full_text
        assert "color: red" not in result.full_text


@pytest.mark.unit
class TestBaseParserMethods:
    """Tests for BaseParser utility methods"""

    def test_clean_text_whitespace(self):
        """Test cleaning excessive whitespace"""
        parser = MarkdownParser()  # Use concrete implementation

        text = "Too    many     spaces"
        result = parser._clean_text(text)
        assert result == "Too many spaces"

    def test_clean_text_newlines(self):
        """Test cleaning newlines"""
        parser = MarkdownParser()

        text = "Line one\nLine two\n\nLine three"
        result = parser._clean_text(text)
        assert "\n" not in result
        assert "Line one Line two Line three" == result

    def test_clean_text_strip(self):
        """Test stripping leading/trailing whitespace"""
        parser = MarkdownParser()

        text = "   surrounded by spaces   "
        result = parser._clean_text(text)
        assert result == "surrounded by spaces"

    def test_clean_text_empty(self):
        """Test cleaning empty string"""
        parser = MarkdownParser()

        result = parser._clean_text("")
        assert result == ""

    def test_clean_text_only_whitespace(self):
        """Test cleaning string with only whitespace"""
        parser = MarkdownParser()

        result = parser._clean_text("   \n  \t  ")
        assert result == ""
