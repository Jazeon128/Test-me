"""Source names reflect titles and original file types."""
from types import SimpleNamespace

import pytest

from app.models.document import DocumentType
from app.services.source_names import display_name


@pytest.mark.parametrize("title,filename,kind,expected", [
    ("AWS Gen AI - Dev Prof Cheat sheet.docx", "AWS-Gen-AI---Dev-Prof-Cheat-sheet.docx.pdf",
     DocumentType.PDF, "AWS Gen AI - Dev Prof Cheat sheet"),
    (".pdf", "notes.pdf", DocumentType.PDF, "notes"),
    ("A useful title", "file.pdf", DocumentType.PDF, "A useful title"),
    (None, "file.pdf", DocumentType.PDF, "file"),
    ("", "file.md", DocumentType.MARKDOWN, "file"),
    ("Video title.docx", "video.youtube", DocumentType.YOUTUBE, "Video title.docx"),
    (None, "video.youtube", DocumentType.YOUTUBE, "video"),
])
def test_display_name(title, filename, kind, expected):
    document = SimpleNamespace(title=title, original_filename=filename, file_type=kind)
    assert display_name(document) == expected


@pytest.mark.parametrize("extension", ["docx", "pdf", "pptx", "md", "html", "txt"])
def test_metadata_extension_is_case_insensitive(extension):
    document = SimpleNamespace(
        title=f"Misleading.{extension.upper()}", original_filename="original.pdf",
        file_type=DocumentType.PDF,
    )
    assert display_name(document) == "Misleading"
