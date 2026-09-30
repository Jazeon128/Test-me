"""Names shown for source documents."""
import os
import re

from ..models.document import DocumentType

_FILE_EXTENSION = re.compile(r"\.(docx|pdf|pptx|md|html|txt)$", re.IGNORECASE)


def display_name(document) -> str:
    """YouTube keeps its title. Other titles lose a trailing file extension,
    because PDF metadata often names the file it was exported from."""
    title = (document.title or "").strip()
    if document.file_type == DocumentType.YOUTUBE and title:
        return title
    title = _FILE_EXTENSION.sub("", title).strip()
    if title:
        return title
    return os.path.splitext(document.original_filename)[0]
