"""Save and parse notebook sources independently of question generation."""
import hashlib
import os
from datetime import datetime

from sqlalchemy import func

from ..config import settings
from ..db import SessionLocal
from ..models.document import Document, DocumentType
from ..models.passage import DocumentPassage
from .parsers import (PDFParser, HTMLParser, MarkdownParser, DOCXParser,
                      PowerPointParser, YouTubeParser)
from .passages import split_passages
from ..utils.cache import invalidate_stats_cache


def _parser_for(file_type):
    return {
        DocumentType.PDF: PDFParser, DocumentType.HTML: HTMLParser,
        DocumentType.MARKDOWN: MarkdownParser, DocumentType.DOCX: DOCXParser,
        DocumentType.PPTX: PowerPointParser, DocumentType.YOUTUBE: YouTubeParser,
    }[file_type]()


def save_source(db, *, notebook_id, filename, content: bytes):
    content_hash = hashlib.sha256(content).hexdigest()
    existing = db.query(Document).filter_by(
        notebook_id=notebook_id, content_hash=content_hash,
    ).first()
    if existing:
        return existing, False
    extension = os.path.splitext(filename)[1].lower()
    file_type = {
        ".pdf": DocumentType.PDF, ".html": DocumentType.HTML,
        ".htm": DocumentType.HTML, ".md": DocumentType.MARKDOWN,
        ".docx": DocumentType.DOCX, ".pptx": DocumentType.PPTX,
        ".youtube": DocumentType.YOUTUBE,
    }[extension]
    stored_name = f"{datetime.now().strftime('%Y%m%d_%H%M%S_%f')}_{os.path.basename(filename)}"
    path = os.path.join(settings.UPLOAD_DIR, stored_name)
    with open(path, "wb") as handle:
        handle.write(content)
    document = Document(
        notebook_id=notebook_id, filename=stored_name, original_filename=filename,
        file_type=file_type, file_path=path, file_size=len(content),
        content_hash=content_hash, status="processing",
    )
    if file_type == DocumentType.YOUTUBE:
        document.title = YouTubeParser.fetch_title(content.decode("utf-8").strip())
    db.add(document)
    db.commit()
    db.refresh(document)
    invalidate_stats_cache()
    return document, True


def store_passages(db, document, parsed):
    document.passages.clear()
    db.flush()
    passages = split_passages(parsed.sections)
    for passage in passages:
        if document.file_type == DocumentType.YOUTUBE:
            passage["locator"] = f"Part {passage['ordinal'] + 1}"
        document.passages.append(DocumentPassage(**passage))


def store_parsed(db, document, parsed):
    document.content = parsed.full_text
    if document.file_type != DocumentType.YOUTUBE:
        document.title = parsed.title
    document.num_pages = parsed.num_pages
    store_passages(db, document, parsed)
    document.status = "ready"
    document.error_message = None
    document.parsed_at = datetime.now()


def parse_source(db, document_id):
    document = db.get(Document, document_id)
    if document is None:
        return
    try:
        parsed = _parser_for(document.file_type).parse(document.file_path)
        store_parsed(db, document, parsed)
        if not parsed.full_text.strip():
            document.status = "failed"
            document.error_message = "No text could be read from this source."
        db.commit()
        invalidate_stats_cache()
    except Exception as error:
        db.rollback()
        document.status = "failed"
        document.error_message = str(error) or type(error).__name__
        db.commit()


def parse_source_task(document_id):
    with SessionLocal() as db:
        parse_source(db, document_id)


def passage_counts(db, document_ids):
    return dict(db.query(DocumentPassage.document_id, func.count(DocumentPassage.id)).filter(
        DocumentPassage.document_id.in_(document_ids),
    ).group_by(DocumentPassage.document_id).all())


def source_fields(document, counts):
    return dict(status=document.status, error_message=document.error_message,
                passage_count=counts.get(document.id, 0))
