import pytest
from pathlib import Path
from sqlalchemy.orm import sessionmaker

from app import db as database
from app.api import documents
from app.config import settings
from app.models.deck import Deck
from app.models.document import Document, DocumentType
from app.models.generation_status import GenerationStatus
from app.models.notebook import Notebook
from app.models.passage import DocumentPassage


@pytest.fixture
def selected(db_session, monkeypatch):
    monkeypatch.setattr(database, "SessionLocal", sessionmaker(bind=db_session.get_bind()))
    calls = []

    class FakeGenerator:
        def __init__(self, **kwargs):
            self.flagged_questions = []
            self.failed_batches = []

        def generate_questions(self, parsed, num_questions, **kwargs):
            calls.append((parsed.title, num_questions, kwargs))
            return [dict(question=f"Question {index}", options=[dict(option="A", text="Answer")],
                         correct_answer="A") for index in range(num_questions)]

    monkeypatch.setattr(documents, "QuestionGenerator", FakeGenerator)
    notebook = Notebook(name="Selected")
    db_session.add(notebook)
    db_session.flush()
    sources = []
    for index, count in enumerate([8, 1, 1]):
        path = Path(settings.UPLOAD_DIR) / f"source{index}.md"
        path.write_text(f"# Topic {index}\n\nUseful learning content.", encoding="utf-8")
        source = Document(notebook_id=notebook.id, filename=path.name, original_filename=path.name,
                          file_path=str(path), file_type=DocumentType.MARKDOWN, file_size=40,
                          status="ready")
        db_session.add(source)
        db_session.flush()
        for ordinal in range(count):
            db_session.add(DocumentPassage(document_id=source.id, ordinal=ordinal, section_index=0,
                                            locator="Part 1", text="Content", char_start=0, char_end=7))
        sources.append(source)
    db_session.commit()
    return notebook, sources, calls


def request(sources, **overrides):
    return dict(source_ids=[source.id for source in sources], kind="quiz", num_questions=10,
                difficulty="mixed", **overrides)


@pytest.mark.parametrize("kind", ["quiz", "flashcards"])
def test_generation(client, db_session, selected, kind):
    notebook, sources, calls = selected
    body = request(sources)
    body.update(kind=kind, custom_prompt="Use examples", deck_name="Chosen deck")
    response = client.post(f"/api/notebooks/{notebook.id}/generate", json=body)
    assert response.status_code == 202
    result = response.json()
    assert result["split"] == [dict(source_id=s.id, num_questions=n)
                               for s, n in zip(sources, [8, 1, 1])]
    db_session.expire_all()
    deck = db_session.get(Deck, result["deck_id"])
    assert deck.notebook_id == notebook.id
    assert deck.kind == kind
    assert deck.source_ids == body["source_ids"]
    assert deck.name == "Chosen deck"
    assert len(deck.questions) == 10
    assert db_session.query(Deck).count() == 1
    job = db_session.query(GenerationStatus).one()
    assert job.status == "completed"
    assert job.notebook_id == notebook.id
    assert job.source_ids == body["source_ids"]
    assert job.kind == kind
    assert job.result_id == job.deck_id == deck.id
    assert job.documents_completed == job.total_documents == 3
    assert job.total_questions_requested == job.total_questions_generated == 10
    assert ("Card split:" if kind == "flashcards" else "Question split:") in job.logs[0]["message"]
    assert [call[1] for call in calls] == [8, 1, 1]
    assert all(call[2]["custom_prompt"] == "Use examples" for call in calls)


def test_zero_share_skipped(client, db_session, selected):
    notebook, sources, calls = selected
    body = request(sources)
    body["num_questions"] = 1
    response = client.post(f"/api/notebooks/{notebook.id}/generate", json=body)
    assert response.status_code == 202
    assert [s["num_questions"] for s in response.json()["split"]] == [1, 0, 0]
    db_session.expire_all()
    assert db_session.query(GenerationStatus).one().total_documents == 1
    assert len(calls) == 1
    assert db_session.query(Deck).one().name == "source0 + 2 more"


@pytest.mark.parametrize("state,code,key", [
    ("foreign", 400, None), ("missing", 400, None),
    ("processing", 409, "processing"), ("failed", 400, None),
    ("unteachable", 409, "unteachable"),
])
def test_source_validation(client, db_session, selected, state, code, key):
    notebook, sources, calls = selected
    source = sources[0]
    body = request([source])
    if state == "foreign":
        other = Notebook(name="Other")
        db_session.add(other)
        db_session.flush()
        source.notebook_id = other.id
    elif state == "missing":
        body["source_ids"] = [999999]
    elif state == "unteachable":
        source.preflight = dict(worth_generating=False, is_teachable=0.2)
    else:
        source.status = state
    db_session.commit()
    response = client.post(f"/api/notebooks/{notebook.id}/generate", json=body)
    assert response.status_code == code
    if key == "processing":
        assert response.json()[key] == [source.id]
    elif key == "unteachable":
        assert response.json()[key] == [dict(id=source.id, display_name="source0", is_teachable=0.2,
                                            has_study_content=None, reason=None)]
    else:
        assert str(body["source_ids"][0]) in response.json()["error"]["message"]
    assert db_session.query(Deck).count() == 0
    assert not calls


def test_allow_unteachable(client, db_session, selected):
    notebook, sources, calls = selected
    sources[0].preflight = dict(worth_generating=False, is_teachable=0.2)
    db_session.commit()
    assert client.post(f"/api/notebooks/{notebook.id}/generate", json=request(
        sources, allow_unteachable=True,
    )).status_code == 202
    assert len(calls) == 3


@pytest.mark.parametrize("field,value", [
    ("source_ids", []), ("kind", "unknown"), ("num_questions", 0),
    ("num_questions", 101), ("difficulty", "unknown"),
])
def test_invalid_body(client, selected, field, value):
    notebook, sources, calls = selected
    body = request(sources)
    body[field] = value
    assert client.post(f"/api/notebooks/{notebook.id}/generate", json=body).status_code == 422
    assert not calls


def test_unknown_notebook(client, selected):
    _, sources, calls = selected
    assert client.post("/api/notebooks/999999/generate", json=request(sources)).status_code == 404
    assert not calls


def test_failed_generation_removes_new_empty_deck(client, db_session, selected, monkeypatch):
    from app.exceptions import AIServiceError
    attempts = []

    class ExhaustedGenerator:
        def __init__(self, **kwargs):
            pass

        def generate_questions(self, *args, **kwargs):
            if attempts:
                running = db_session.query(GenerationStatus).one()
                db_session.refresh(running)
                assert running.status == "processing"
                assert db_session.get(Deck, running.deck_id) is not None
            attempts.append(True)
            raise AIServiceError(message="The free-tier quota is used up (429).", provider="gemini")

    monkeypatch.setattr(documents, "QuestionGenerator", ExhaustedGenerator)
    notebook, sources, _ = selected
    response = client.post(f"/api/notebooks/{notebook.id}/generate", json=request(sources))
    assert response.status_code == 202
    db_session.expire_all()
    job = db_session.query(GenerationStatus).one()
    assert job.status == "failed"
    assert "quota is used up" in job.error_message
    assert job.logs
    assert job.deck_created is True
    assert len(attempts) == 3
    assert db_session.get(Deck, response.json()["deck_id"]) is None
    assert job.deck_id is None
    assert job.result_id is None
    assert client.get(f"/api/notebooks/{notebook.id}/workspace").json()["artifacts"]["decks"] == []


@pytest.mark.parametrize("material", ["question", "held_back"])
def test_failed_generation_keeps_deck_with_saved_material(client, db_session, selected, monkeypatch, material):
    from app.exceptions import AIServiceError
    from app.models.question import Question
    from app.models.flagged_question import FlaggedQuestion

    notebook, sources, _ = selected
    saved = []

    class FailedGenerator:
        def __init__(self, **kwargs):
            pass

        def generate_questions(self, *args, **kwargs):
            # Save material from another source before this job reaches failed.
            if not saved:
                deck = db_session.query(Deck).one()
                if material == "question":
                    question = Question(document_id=sources[2].id, question_text="Other source", difficulty="easy")
                    db_session.add(question)
                    db_session.flush()
                    deck.questions = [question]
                else:
                    db_session.add(FlaggedQuestion(deck_id=deck.id, document_id=sources[2].id,
                                                   payload={}, reasons=[], status="pending"))
                db_session.commit()
                saved.append(deck.id)
            raise AIServiceError(message="The free-tier quota is used up (429).", provider="gemini")

    monkeypatch.setattr(documents, "QuestionGenerator", FailedGenerator)
    response = client.post(f"/api/notebooks/{notebook.id}/generate", json=request(sources))
    assert response.status_code == 202
    db_session.expire_all()
    job = db_session.query(GenerationStatus).one()
    deck = db_session.get(Deck, response.json()["deck_id"])
    assert job.status == "failed"
    assert job.deck_created is True
    assert deck is not None
    assert job.deck_id == job.result_id == deck.id
    if material == "question":
        assert len(deck.questions) == 1
        assert deck.questions[0].document_id == sources[2].id
    else:
        assert db_session.query(FlaggedQuestion).filter_by(deck_id=deck.id, status="pending").count() == 1


@pytest.mark.parametrize("reason,allow,code", [
    ("study_process", False, 409), ("study_process", True, 202),
    ("low_teachability", False, 409), ("low_teachability", True, 202),
    ("empty", False, 409), ("empty", True, 409),
])
def test_preflight_reasons_and_override(client, db_session, selected, reason, allow, code):
    notebook, sources, calls = selected
    source = sources[0]
    source.preflight = dict(worth_generating=False, is_teachable=.99,
                            has_study_content=.1, reason=reason)
    db_session.commit()
    response = client.post(f"/api/notebooks/{notebook.id}/generate", json=request(
        [source], allow_unteachable=allow,
    ))
    assert response.status_code == code
    if code == 409:
        assert response.json()["unteachable"] == [dict(
            id=source.id, display_name="source0", is_teachable=.99,
            has_study_content=.1, reason=reason,
        )]
        assert not calls
        assert db_session.query(Deck).count() == 0
    else:
        assert len(calls) == 1
