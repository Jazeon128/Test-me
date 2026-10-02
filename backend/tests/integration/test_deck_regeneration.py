"""Regeneration must preserve the old deck until an atomic replacement succeeds."""

from types import SimpleNamespace

import pytest
from fastapi import BackgroundTasks
from sqlalchemy.orm import sessionmaker

from app import db as database
from app.api import documents
from app.models.document import Document, DocumentType
from app.models.generation_status import GenerationStatus
from app.models.question import Question, QuestionOption
from app.models.deck import DeckQuestion
from app.models.user_progress import UserProgress


def generated_question(text, answer="A"):
    return {
        "question": text,
        "correct_answer": answer,
        "options": [{"option": "A", "text": "Right"}, {"option": "B", "text": "Wrong"}],
    }


@pytest.fixture
def regeneration(db_session, sample_test, sample_user_progress, monkeypatch):
    monkeypatch.setattr(database, "SessionLocal", sessionmaker(bind=db_session.bind))
    extra = Document(
        filename="extra.md", original_filename="extra.md", file_path="extra.md",
        file_type=DocumentType.MARKDOWN, file_size=10,
    )
    uploaded = Document(
        filename="uploaded.md", original_filename="uploaded.md", file_path="uploaded.md",
        file_type=DocumentType.MARKDOWN, file_size=10,
    )
    db_session.add_all([extra, uploaded])
    db_session.flush()
    old = Question(document_id=extra.id, question_text="Second old question")
    db_session.add(old)
    db_session.flush()
    sample_test.deck_questions.append(DeckQuestion(question_id=old.id, order=1))
    job = GenerationStatus(job_id="regeneration", deck_id=sample_test.id, logs=[])
    db_session.add(job)
    db_session.commit()
    old_ids = [q.id for q in sample_test.questions]
    doc_ids = [q.document_id for q in sample_test.questions] + [uploaded.id]
    calls = []

    class Parser:
        def parse(self, path):
            return SimpleNamespace(full_text=path, sections=[], title=path, num_pages=1)

    # Fake every parser used by the old and new implementations. No files or API calls.
    for name in ["PDFParser", "HTMLParser", "MarkdownParser", "DOCXParser", "PowerPointParser", "YouTubeParser"]:
        monkeypatch.setattr(documents, name, Parser)

    class Generator:
        def __init__(self, **kwargs):
            pass

        def generate_questions(self, parsed, **kwargs):
            calls.append((parsed.full_text, kwargs))
            callback = kwargs.get("progress_callback")
            if callback:
                callback(1, kwargs["num_questions"])
            return [generated_question(f"New {parsed.full_text}", " a ")]

    monkeypatch.setattr(documents, "QuestionGenerator", Generator)
    return SimpleNamespace(
        deck_id=sample_test.id, old_ids=old_ids, doc_ids=doc_ids, calls=calls,
        generator=Generator, progress_id=sample_user_progress.id,
    )


def run_regeneration(state):
    documents.regenerate_deck_questions(
        state.deck_id, 2, "hard", "Custom prompt", "regeneration",
        new_document_ids=[state.doc_ids[-1], state.doc_ids[0], state.doc_ids[-1]],
    )


def test_regeneration_success(db_session, regeneration):
    run_regeneration(regeneration)
    db_session.expire_all()
    questions = db_session.query(Question).order_by(Question.document_id).all()
    assert [q.document_id for q in questions] == regeneration.doc_ids
    assert all(q.question_text.startswith("New ") for q in questions)
    assert len(regeneration.calls) == 3
    assert all(call[1]["num_questions"] == 2 for call in regeneration.calls)
    assert all(call[1]["difficulty"] == "hard" for call in regeneration.calls)
    assert all(call[1]["custom_prompt"] == "Custom prompt" for call in regeneration.calls)
    assert db_session.query(UserProgress).count() == 0
    assert [link.order for link in db_session.query(DeckQuestion).order_by(DeckQuestion.order)] == [0, 1, 2]
    assert all([o.option_text for o in q.options if o.is_correct] == ["Right"] for q in questions)
    job = db_session.query(GenerationStatus).one()
    assert job.status == "completed"
    assert job.total_questions_generated == 3
    assert job.total_documents == 3
    assert job.started_at and job.completed_at
    assert job.progress == 100
    assert job.logs


@pytest.mark.parametrize("failure", ["generator", "parser", "zero", "saving"])
def test_regeneration_failure_keeps_old_deck(db_session, regeneration, monkeypatch, failure):
    original = regeneration.generator.generate_questions

    def generate(self, parsed, **kwargs):
        if failure == "zero":
            return []
        if parsed.full_text == "extra.md":
            raise ValueError("Generator 429")
        return original(self, parsed, **kwargs)

    if failure in ("generator", "zero"):
        monkeypatch.setattr(regeneration.generator, "generate_questions", generate)
    elif failure == "parser":
        def parse(self, path):
            raise ValueError("Cannot parse document")
        monkeypatch.setattr(documents.MarkdownParser, "parse", parse)
    else:
        save = documents._save_generated_question
        count = 0

        def fail_save(*args):
            nonlocal count
            count += 1
            if count == 2:
                raise RuntimeError("Save failed")
            return save(*args)

        monkeypatch.setattr(documents, "_save_generated_question", fail_save)

    run_regeneration(regeneration)
    db_session.expire_all()
    assert [q.id for q in db_session.query(Question).order_by(Question.id)] == regeneration.old_ids
    assert db_session.get(UserProgress, regeneration.progress_id).question_id == regeneration.old_ids[0]
    assert db_session.query(QuestionOption).count() == 4
    assert db_session.query(DeckQuestion).count() == 2
    job = db_session.query(GenerationStatus).one()
    assert job.status == "failed"
    assert "existing 2 questions were kept" in job.error_message
    assert job.completed_at


def test_schedule_passes_uploaded_documents():
    tasks = BackgroundTasks()
    message = documents.schedule_generation(tasks, {
        "mode": "regenerate", "documents": [{"id": 7}, {"id": 8}],
        "deck_id": 3, "num_questions": 2, "difficulty": "mixed", "custom_prompt": None,
    }, "job")
    assert tasks.tasks[0].args == (3, 2, "mixed", None, "job", [7, 8])
    assert message == (
        "Regenerating all questions in the deck from 2 document(s). "
        "Your existing questions are kept until the new ones are ready."
    )


@pytest.mark.parametrize("answer", ["a", " A "])
def test_process_document_normalizes_answer(db_session, regeneration, monkeypatch, answer):
    monkeypatch.setattr(regeneration.generator, "generate_questions", lambda *args, **kwargs: [
        generated_question("Normal generation", answer)
    ])
    documents.process_document(
        regeneration.doc_ids[-1], "uploaded.md", DocumentType.MARKDOWN, 1, "mixed",
        regeneration.deck_id,
    )
    db_session.expire_all()
    question = db_session.query(Question).filter_by(question_text="Normal generation").one()
    assert [o.option_text for o in question.options if o.is_correct] == ["Right"]
