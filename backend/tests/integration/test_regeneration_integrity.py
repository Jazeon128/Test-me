from types import SimpleNamespace

import pytest
from app.api import documents as api
from app.models.document import Document, DocumentType
from app.models.test import Test as Deck
from app.models.generation_status import GenerationStatus
from app.models.flagged_question import FlaggedQuestion
from app.services.parsers.base_parser import ParsedDocument, ParsedSection


def payload():
    return {"question": "New question?", "options": [{"option": c, "text": c} for c in "ABCD"], "correct_answer": "A", "explanation": "Because"}


@pytest.fixture
def setup_job(db_session, sample_test, monkeypatch):
    monkeypatch.setattr("app.db.SessionLocal", lambda: db_session)
    monkeypatch.setattr(db_session, "close", lambda: None)
    parsed = ParsedDocument("Source", [ParsedSection("Source")])
    monkeypatch.setattr(api, "_parser_for", lambda kind: SimpleNamespace(parse=lambda path: parsed))
    job = GenerationStatus(job_id="regen", deck_id=sample_test.id)
    db_session.add(job)
    db_session.commit()
    return sample_test, job


@pytest.mark.parametrize("failure", ["partial", "raise", "empty"])
def test_failed_source_keeps_whole_deck(db_session, setup_job, monkeypatch, failure):
    deck, job = setup_job
    second = Document(filename="second.md", original_filename="second.md", file_type=DocumentType.MARKDOWN, file_path="second.md", file_size=1)
    db_session.add(second)
    db_session.flush()
    old = list(deck.questions)
    class Generator:
        calls = 0
        flagged_questions = []
        failed_batches = []
        def generate_questions(self, *args, **kwargs):
            self.calls += 1
            if self.calls == 2:
                if failure == "raise":
                    raise ValueError("503 UNAVAILABLE")
                self.failed_batches = [{"message": "503 UNAVAILABLE"}] if failure == "partial" else []
                return [payload()] if failure == "partial" else []
            return [payload()]
    monkeypatch.setattr(api, "QuestionGenerator", lambda **kwargs: Generator())
    api.regenerate_deck_questions(deck.id, 1, "mixed", job_id=job.job_id, new_document_ids=[second.id])
    db_session.expire_all()
    assert [q.id for q in deck.questions] == [q.id for q in old]
    assert job.status == "failed"
    assert "second.md" in job.error_message
    assert "The existing 1 questions were kept." in job.error_message


def test_shared_question_and_progress_survive(db_session, setup_job, sample_question, sample_user_progress, monkeypatch):
    deck, job = setup_job
    sample_user_progress.times_seen = 7
    sample_user_progress.interval = 9
    other = Deck(name="Other")
    other.questions = [sample_question]
    db_session.add(other)
    db_session.commit()
    monkeypatch.setattr(api, "QuestionGenerator", lambda **kwargs: SimpleNamespace(generate_questions=lambda *a, **k: [payload()], flagged_questions=[], failed_batches=[]))
    api.regenerate_deck_questions(deck.id, 1, "mixed", job_id=job.job_id)
    db_session.expire_all()
    assert job.status == "completed"
    assert other.questions[0].id == sample_question.id
    assert sample_user_progress.times_seen == 7
    assert sample_user_progress.interval == 9
    assert db_session.get(type(sample_user_progress), sample_user_progress.id) is not None
    assert deck.questions[0].id != sample_question.id


def test_all_held_back_saved(db_session, setup_job, monkeypatch):
    deck, job = setup_job
    old_ids = [q.id for q in deck.questions]
    held = dict(payload(), flags=["unsupported"])
    class Generator:
        flagged_questions = []
        failed_batches = []
        def generate_questions(self, *args, **kwargs):
            self.flagged_questions = [held]
            return []
    monkeypatch.setattr(api, "QuestionGenerator", lambda **kwargs: Generator())
    api.regenerate_deck_questions(deck.id, 1, "mixed", job_id=job.job_id)
    db_session.expire_all()
    assert [q.id for q in deck.questions] == old_ids
    assert db_session.query(FlaggedQuestion).filter_by(deck_id=deck.id).count() == 1
    assert job.total_questions_flagged == 1
    assert job.status == "failed"
    assert job.error_message == "Every regenerated question was held back by the quality check. The existing 1 questions were kept. Review the held-back questions on the deck page."
