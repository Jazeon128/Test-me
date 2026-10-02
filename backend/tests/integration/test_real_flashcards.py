import json
from types import SimpleNamespace
from unittest.mock import Mock

import pytest
from sqlalchemy.orm import sessionmaker

from app import db as database
from app.api import documents
from app.api.questions import expected_answer, key_points
from app.models.deck import Deck
from app.models.document import Document, DocumentType
from app.models.flagged_question import FlaggedQuestion
from app.models.generation_status import GenerationStatus
from app.models.notebook import Notebook
from app.models.passage import DocumentPassage
from app.models.question import Question
from app.services import jev
from app.services.ai.question_generator import QuestionGenerator


@pytest.mark.parametrize("kind", ["quiz", "flashcards"])
def test_notebook_generation_real_cards(client, db_session, monkeypatch, tmp_path, kind):
    source = "SM-2 schedules reviews."
    path = tmp_path / "source.md"
    path.write_text(source, encoding="utf-8")
    notebook = Notebook(name="Study")
    db_session.add(notebook)
    db_session.flush()
    document = Document(notebook_id=notebook.id, filename=path.name, original_filename=path.name,
                        file_path=str(path), file_type=DocumentType.MARKDOWN, file_size=len(source),
                        status="ready")
    db_session.add(document)
    db_session.flush()
    db_session.add(DocumentPassage(document_id=document.id, ordinal=0, section_index=0,
                                  locator="Part 1", text=source, char_start=0, char_end=len(source)))
    db_session.commit()
    monkeypatch.setattr(database, "SessionLocal", sessionmaker(bind=db_session.get_bind()))

    def initialize(instance, **kwargs):
        instance.db = None
        instance.provider = "openai"
        instance.model = "fixture"
        instance.step_callback = None
        instance.client = Mock()
        cards = [dict(front="What does SM-2 schedule?", back="Reviews."),
                 dict(front="What is scheduled?", back="Uploads.")]
        questions = [dict(question="What does SM-2 schedule?", explanation="Reviews.",
                          options=[dict(option="A", text="Reviews"), dict(option="B", text="Uploads")],
                          correct_answer="A")]
        instance.client.chat.completions.create.return_value = SimpleNamespace(
            choices=[SimpleNamespace(message=SimpleNamespace(content=json.dumps(
                cards if kind == "flashcards" else questions)))],
            usage=SimpleNamespace(prompt_tokens=20, completion_tokens=30),
        )

    monkeypatch.setattr(QuestionGenerator, "__init__", initialize)
    monkeypatch.setattr(QuestionGenerator, "_typesafe_key", lambda self: "fixture-key")

    def ask(state, questions, **kwargs):
        bad = state.get("card", {}).get("back") == "Uploads."
        return jev.Answers({name: {"noul": 0.9 if bad and name == "back_not_supported" else 0.1}
                            for name in questions})

    monkeypatch.setattr(jev, "ask", ask)
    response = client.post(f"/api/notebooks/{notebook.id}/generate", json=dict(
        source_ids=[document.id], kind=kind, num_questions=2, difficulty="mixed",
    ))
    assert response.status_code == 202
    db_session.expire_all()
    deck = db_session.get(Deck, response.json()["deck_id"])
    assert len(deck.questions) == 1
    question = deck.questions[0]
    assert question.card_type == ("flashcard" if kind == "flashcards" else "mcq")
    assert len(question.options) == (0 if kind == "flashcards" else 2)
    assert question.question_text == "What does SM-2 schedule?"
    assert question.explanation == "Reviews."
    assert question.source_reference["passage"] == source
    job = db_session.query(GenerationStatus).one()
    assert job.status == "completed"
    if kind == "flashcards":
        held = db_session.query(FlaggedQuestion).one()
        assert held.payload["card_type"] == "flashcard"
        assert "options" not in held.payload
        assert held.reasons
        listed = client.get('/api/flagged', params=dict(deck_id=deck.id)).json()[0]
        assert listed["card_type"] == "flashcard"
        assert listed["explanation"] == "Uploads."
        restored = client.post(f"/api/flagged/{held.id}/restore")
        assert restored.status_code == 200
        db_session.expire_all()
        restored_question = db_session.get(Question, restored.json()["question_id"])
        assert restored_question.card_type == "flashcard"
        assert restored_question.options == []
        assert any("cards" in log["message"] for log in job.logs)
    else:
        assert db_session.query(FlaggedQuestion).count() == 0


def test_flashcard_read_paths_and_mode_guards(client, db_session):
    deck = Deck(name="SM-2 deck")
    db_session.add(deck)
    db_session.flush()
    question = documents._save_generated_question(db_session, dict(
        card_type="flashcard", question="SM-2 schedule?", explanation="Reviews.",
    ), None, deck)
    db_session.commit()
    assert expected_answer(question) == "Reviews."
    assert key_points(question) == ["Reviews."]
    assert client.get(f"/api/questions/{question.id}").json()["card_type"] == "flashcard"
    assert client.get(f"/api/decks/{deck.id}").json()["questions"][0]["card_type"] == "flashcard"
    assert client.get(f"/api/tests/{deck.id}").json()["questions"][0]["card_type"] == "flashcard"
    started = client.post(f"/api/tests/{deck.id}/start").json()["questions"][0]
    assert started["card_type"] == "flashcard"
    assert started["explanation"] == "Reviews."
    review = client.post('/api/progress/review-session', json=dict(deck_id=deck.id)).json()
    assert review["questions"][0]["card_type"] == "flashcard"
    assert review["questions"][0]["options"] == []
    results = client.get('/api/search/', params=dict(q="SM-2")).json()["results"]
    assert next(r for r in results if r["type"] == "question")["card_type"] == "flashcard"
    for body in (dict(written_answer="Reviews."), dict(explain=True)):
        response = client.post('/api/progress/submit', json=dict(
            question_id=question.id, time_taken_seconds=1, **body,
        ))
        assert response.status_code == 422
    assert client.post(f"/api/questions/{question.id}/grade", json=dict(answer="Reviews.")).status_code == 422
    assert client.post('/api/progress/submit', json=dict(
        question_id=question.id, time_taken_seconds=1, manual_quality=4,
    )).status_code == 200
    for format_name in ("anki", "csv", "anki-csv"):
        exported = client.get(f"/api/decks/{deck.id}/export/{format_name}")
        assert exported.status_code == 200
        assert exported.content


def test_restore_rejects_unknown_card_type(client, db_session):
    deck = Deck(name="Invalid card")
    db_session.add(deck)
    db_session.flush()
    held = FlaggedQuestion(deck_id=deck.id, payload=dict(card_type="unknown", question="Prompt"),
                          reasons=["Unsupported"])
    db_session.add(held)
    db_session.commit()
    assert client.post(f"/api/flagged/{held.id}/restore").status_code == 422
    assert db_session.query(Question).count() == 0


def test_legacy_csv_placeholder_unchanged(client, db_session):
    response = client.post('/api/decks/import/csv', files={
        "file": ("legacy.csv", b"SM-2?,Reviews.\n", "text/csv"),
    })
    assert response.status_code == 200
    question = db_session.get(Deck, response.json()["id"]).questions[0]
    assert question.card_type == "mcq"
    assert len(question.options) == 1
    assert question.options[0].option_text == "Flip to see answer"
    assert expected_answer(question) == "Reviews."
