"""Exercise generation and the held-back review routes without external APIs."""
from types import SimpleNamespace

import pytest
from sqlalchemy.orm import sessionmaker

from app import db as database
from app.api import documents
from app.models.deck import Deck
from app.models.document import Document, DocumentType
from app.models.flagged_question import FlaggedQuestion
from app.models.generation_status import GenerationStatus
from app.models.question import Question


def question(text):
    return {
        "question": text, "options": [
            {"option": "A", "text": "Wrong"}, {"option": "B", "text": "Right"},
        ], "correct_answer": " b ", "explanation": "Because", "difficulty": "hard",
        "reference": {"page": 1},
    }


@pytest.fixture
def generation(db_session, sample_document, monkeypatch):
    monkeypatch.setattr(database, "SessionLocal", sessionmaker(bind=db_session.bind))

    class Parser:
        def parse(self, path):
            return SimpleNamespace(full_text=path, title=path, sections=[], num_pages=1)

    for name in ["PDFParser", "HTMLParser", "MarkdownParser", "DOCXParser", "PowerPointParser", "YouTubeParser"]:
        monkeypatch.setattr(documents, name, Parser)

    class Generator:
        def __init__(self, **kwargs):
            self.flagged_questions = []

        def generate_questions(self, parsed, **kwargs):
            self.flagged_questions.append({**question(f"Held {parsed.full_text}"), "flags": ["Ambiguous", "Unsupported"]})
            return [question("Passed one"), question("Passed two")]

    monkeypatch.setattr(documents, "QuestionGenerator", Generator)
    deck = Deck(name="Review deck")
    db_session.add(deck)
    db_session.flush()
    job = GenerationStatus(job_id="held-job", deck_id=deck.id, logs=[])
    db_session.add(job)
    db_session.commit()
    return SimpleNamespace(deck_id=deck.id, document_id=sample_document.id, generator=Generator)


def process(state):
    documents.process_document(state.document_id, "fake.pdf", DocumentType.PDF, 3, "mixed",
                               state.deck_id, job_id="held-job")


def test_process_and_restore(client, db_session, generation):
    process(generation)
    db_session.expire_all()
    assert len(db_session.get(Deck, generation.deck_id).questions) == 2
    item = db_session.query(FlaggedQuestion).one()
    assert item.status == "pending"
    assert item.deck_id == generation.deck_id
    assert item.document_id == generation.document_id
    assert item.job_id == "held-job"
    assert item.reasons == ["Ambiguous", "Unsupported"]
    assert "flags" not in item.payload
    job = db_session.query(GenerationStatus).one()
    assert job.status == "completed"
    assert job.to_dict()["total_questions_flagged"] == 1
    assert any(log["message"] == "1 question(s) held back by the quality check" for log in job.logs)
    response = client.get(f"/api/flagged?deck_id={generation.deck_id}")
    assert response.status_code == 200
    listed = response.json()[0]
    assert listed["id"] == item.id
    assert listed["question"] == "Held fake.pdf"
    assert listed["options"] == item.payload["options"]
    assert listed["correct_answer"] == " b "
    assert listed["explanation"] == "Because"
    assert listed["reasons"] == item.reasons
    assert listed["document_id"] == generation.document_id
    assert listed["created_at"]
    response = client.post(f"/api/flagged/{item.id}/restore")
    assert response.status_code == 200
    db_session.expire_all()
    restored = db_session.get(Question, response.json()["question_id"])
    assert restored.question_text == "Held fake.pdf"
    assert restored.document_id == generation.document_id
    assert restored.explanation == "Because"
    assert restored.difficulty == "hard"
    assert [option.option_text for option in restored.options if option.is_correct] == ["Right"]
    assert len(db_session.get(Deck, generation.deck_id).questions) == 3
    assert item.status == "restored" and item.resolved_at
    assert client.post(f"/api/flagged/{item.id}/restore").status_code == 409
    assert client.post(f"/api/flagged/{item.id}/discard").status_code == 409
    assert client.get(f"/api/flagged?deck_id={generation.deck_id}").json() == []


def test_discard_and_unknown_ids(client, db_session, generation):
    process(generation)
    item = db_session.query(FlaggedQuestion).one()
    assert client.post(f"/api/flagged/{item.id}/discard").status_code == 200
    db_session.expire_all()
    assert item.status == "discarded" and item.resolved_at
    assert db_session.query(Question).count() == 2
    assert client.get(f"/api/flagged?deck_id={generation.deck_id}").json() == []
    assert client.post(f"/api/flagged/{item.id}/discard").status_code == 409
    for action in ("restore", "discard"):
        assert client.post(f"/api/flagged/999999/{action}").status_code == 404


def test_list_order_and_missing_deck(client, db_session, generation):
    process(generation)
    first = db_session.query(FlaggedQuestion).one()
    second = FlaggedQuestion(deck_id=generation.deck_id, payload=question("Second"), reasons=["Reason"])
    other = FlaggedQuestion(deck_id=None, payload=question("Orphan"), reasons=[])
    db_session.add_all([second, other])
    db_session.commit()
    assert [item["id"] for item in client.get(f"/api/flagged?deck_id={generation.deck_id}").json()] == [second.id, first.id]
    assert client.post(f"/api/flagged/{other.id}/restore").status_code == 409
    assert other.status == "pending"


@pytest.mark.parametrize("failure", [None, "generator", "saving"])
def test_regeneration_is_atomic(db_session, generation, monkeypatch, failure):
    deck = db_session.get(Deck, generation.deck_id)
    old = documents._save_generated_question(db_session, question("Old"), generation.document_id, deck)
    extra = Document(filename="extra.md", original_filename="extra.md", file_path="extra.md",
                     file_type=DocumentType.MARKDOWN, file_size=1)
    db_session.add(extra)
    db_session.commit()
    old_id = old.id
    original = generation.generator.generate_questions

    def generate(self, parsed, **kwargs):
        if failure == "generator" and parsed.full_text == "extra.md":
            raise ValueError("Generation failed")
        return original(self, parsed, **kwargs)

    monkeypatch.setattr(generation.generator, "generate_questions", generate)
    if failure == "saving":
        # Fail after rows and count are staged, proving the final commit rolls back.
        original_commit = documents.Session.commit

        def commit(session):
            if session.query(FlaggedQuestion).count() or any(isinstance(obj, FlaggedQuestion) for obj in session.new):
                raise ValueError("Saving failed")
            return original_commit(session)

        monkeypatch.setattr(documents.Session, "commit", commit)
    documents.regenerate_deck_questions(generation.deck_id, 3, "mixed", job_id="held-job",
                                        new_document_ids=[extra.id])
    db_session.expire_all()
    job = db_session.query(GenerationStatus).one()
    if failure:
        assert job.status == "failed"
        assert job.total_questions_flagged == 0
        assert db_session.query(FlaggedQuestion).count() == 0
        assert [q.id for q in db_session.get(Deck, generation.deck_id).questions] == [old_id]
    else:
        assert job.status == "completed"
        assert job.total_questions_flagged == 2
        assert len(db_session.get(Deck, generation.deck_id).questions) == 4
        items = db_session.query(FlaggedQuestion).order_by(FlaggedQuestion.id).all()
        assert [item.document_id for item in items] == [generation.document_id, extra.id]
        assert all(item.status == "pending" and item.job_id == "held-job" for item in items)


@pytest.mark.parametrize("resource", ["decks", "documents"])
def test_delete_removes_flagged_rows(client, db_session, generation, resource):
    process(generation)
    original = db_session.query(FlaggedQuestion).one()
    original_id = original.id
    # Delete resolved items too, while leaving unrelated items intact.
    resolved = FlaggedQuestion(deck_id=generation.deck_id, document_id=generation.document_id,
                               payload=question("Resolved"), reasons=[], status="discarded")
    unrelated = FlaggedQuestion(payload=question("Unrelated"), reasons=[])
    db_session.add_all([resolved, unrelated])
    db_session.commit()
    resolved_id, unrelated_id = resolved.id, unrelated.id
    resource_id = generation.deck_id if resource == "decks" else generation.document_id
    assert client.delete(f"/api/{resource}/{resource_id}").status_code == 200
    db_session.expire_all()
    assert db_session.get(FlaggedQuestion, original_id) is None
    assert db_session.get(FlaggedQuestion, resolved_id) is None
    assert db_session.get(FlaggedQuestion, unrelated_id) is not None


@pytest.mark.parametrize("mode", ["process", "regenerate"])
def test_no_held_back_log_for_zero_count(db_session, generation, monkeypatch, mode):
    monkeypatch.setattr(generation.generator, "generate_questions",
                        lambda *args, **kwargs: [question("Passed")])
    if mode == "process":
        process(generation)
    else:
        documents.regenerate_deck_questions(generation.deck_id, 1, "mixed", job_id="held-job",
                                            new_document_ids=[generation.document_id])
    db_session.expire_all()
    job = db_session.query(GenerationStatus).one()
    assert job.status == "completed"
    assert job.total_questions_flagged == 0
    assert not any("held back by the quality check" in log["message"] for log in job.logs)
