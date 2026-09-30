from types import SimpleNamespace
from unittest.mock import Mock

import pytest
from sqlalchemy.orm import sessionmaker

from app.api import documents
from app.models.document import Document, DocumentType
from app.models.generation_status import GenerationStatus
from app.models.test import Test as Deck
from app.services.ai.question_generator import QuestionGenerator
from app.services.parsers.base_parser import ParsedDocument, ParsedSection
from app.services.parsers.markdown_parser import MarkdownParser


MESSAGE = (
    "This document has no extractable text. If it is a scanned PDF, "
    "run OCR on it first."
)


@pytest.fixture
def empty_markdown(tmp_path):
    path = tmp_path / "empty.md"
    path.write_text(" \n\t\n   ", encoding="utf-8")
    return path


@pytest.fixture
def generator():
    generator = QuestionGenerator.__new__(QuestionGenerator)
    generator.provider = "gemini"
    generator.model = "fake"
    generator.db = None
    generator.client = SimpleNamespace(models=SimpleNamespace(generate_content=Mock()))
    generator._select_sections = Mock(wraps=generator._select_sections)
    return generator


def test_empty_markdown_fails_before_client_call(empty_markdown, generator):
    parsed = MarkdownParser().parse(str(empty_markdown))

    with pytest.raises(ValueError) as error:
        generator.generate_questions(parsed, 3)

    assert str(error.value) == MESSAGE
    generator.client.models.generate_content.assert_not_called()
    generator._select_sections.assert_not_called()


def test_whitespace_sections_fail_before_client_call(generator):
    parsed = ParsedDocument(" \n\t", [ParsedSection(" \n\t")])

    with pytest.raises(ValueError) as error:
        generator.generate_questions(parsed, 3)

    assert str(error.value) == MESSAGE
    generator.client.models.generate_content.assert_not_called()
    generator._select_sections.assert_not_called()


@pytest.mark.parametrize("regenerate", [False, True])
def test_empty_document_job_fails(
    empty_markdown, generator, db_session, monkeypatch, regenerate,
):
    monkeypatch.setattr("app.db.SessionLocal", sessionmaker(bind=db_session.bind))
    monkeypatch.setattr(documents, "QuestionGenerator", lambda db: generator)
    document = Document(
        filename=empty_markdown.name,
        original_filename=empty_markdown.name,
        file_path=str(empty_markdown),
        file_type=DocumentType.MARKDOWN,
        file_size=empty_markdown.stat().st_size,
    )
    deck = Deck(name="Empty document deck")
    job = GenerationStatus(job_id="empty-job", total_documents=1)
    db_session.add_all([document, deck, job])
    db_session.commit()

    if regenerate:
        documents.regenerate_deck_questions(
            deck.id, 3, "medium", job_id=job.job_id, new_document_ids=[document.id],
        )
    else:
        documents.process_document(
            document.id, str(empty_markdown), DocumentType.MARKDOWN,
            3, "medium", job_id=job.job_id,
        )

    db_session.refresh(job)
    assert job.status == "failed"
    assert MESSAGE in job.error_message
    assert job.total_questions_generated == 0
    generator.client.models.generate_content.assert_not_called()
    generator._select_sections.assert_not_called()
