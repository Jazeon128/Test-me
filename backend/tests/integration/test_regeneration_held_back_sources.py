from types import SimpleNamespace

from app.api import documents as api
from app.models.document import Document, DocumentType
from app.models.flagged_question import FlaggedQuestion
from app.models.generation_status import GenerationStatus
from app.models.test import Test as Deck
from app.services.parsers.base_parser import ParsedDocument, ParsedSection


def test_pending_only_source_is_parsed(db_session, sample_document, monkeypatch):
    deck = Deck(name='Held back only')
    other = Deck(name='Other deck')
    ignored = Document(filename='ignored.md', original_filename='ignored.md', file_type=DocumentType.MARKDOWN, file_path='ignored.md', file_size=1)
    db_session.add_all([deck, other, ignored])
    db_session.flush()
    for deck_id, document_id, status in [
        (deck.id, sample_document.id, 'pending'),
        (deck.id, sample_document.id, 'pending'),
        (deck.id, None, 'pending'),
        (deck.id, ignored.id, 'dismissed'),
        (other.id, ignored.id, 'pending'),
    ]:
        db_session.add(FlaggedQuestion(deck_id=deck_id, document_id=document_id, status=status, payload={}, reasons=[]))
    job = GenerationStatus(job_id='fake-held-back', deck_id=deck.id)
    db_session.add(job)
    db_session.commit()
    paths = []

    def parse(path):
        paths.append(path)
        return ParsedDocument('Source', [ParsedSection('Source')])

    def generate(*args, **kwargs):
        return [{'question': 'Fake question?', 'options': [{'option': c, 'text': c} for c in 'ABCD'], 'correct_answer': 'A', 'explanation': 'Fake explanation'}]

    monkeypatch.setattr('app.db.SessionLocal', lambda: db_session)
    monkeypatch.setattr(db_session, 'close', lambda: None)
    monkeypatch.setattr(api, '_parser_for', lambda kind: SimpleNamespace(parse=parse))
    monkeypatch.setattr(api, 'QuestionGenerator', lambda **kwargs: SimpleNamespace(generate_questions=generate, flagged_questions=[], failed_batches=[]))
    api.regenerate_deck_questions(deck.id, 1, 'mixed', job_id=job.job_id)
    assert paths == [sample_document.file_path]
    assert job.status == 'completed'
    assert [q.document_id for q in deck.questions] == [sample_document.id]
