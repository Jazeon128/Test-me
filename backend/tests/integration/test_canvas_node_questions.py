"""Canvas node generation persists in one reusable practice deck."""
from unittest.mock import Mock

import pytest

from app.api import canvas as api
from app.models.canvas import Canvas
from app.models.deck import Deck, DeckQuestion
from app.models.document import Document, DocumentType
from app.models.flagged_question import FlaggedQuestion
from app.models.notebook import Notebook
from app.models.question import Question


@pytest.fixture
def setup_node(db_session, sample_document, monkeypatch):
    notebook = Notebook(name="Canvas notes")
    db_session.add(notebook)
    db_session.flush()
    sample_document.notebook_id = notebook.id
    second = Document(notebook_id=notebook.id, filename="second.md", original_filename="second.md",
                      file_path="/unused/second.md", file_type=DocumentType.MARKDOWN, file_size=20)
    db_session.add(second)
    db_session.flush()
    canvas = Canvas(document_id=sample_document.id, source_ids=[sample_document.id, second.id],
                    title="Connections", request_text="Draw", template="flowchart",
                    payload_json={"nodes": [{"id": "n", "label": "Topic", "source_section_id": "s"},
                                            {"id": "other", "label": "Other", "source_section_id": "s"}]},
                    sources_json=[{"id": "s", "text": "Second source passage", "document_id": second.id}])
    db_session.add(canvas)
    db_session.commit()
    accepted = {"question": "What is the topic?", "options": [{"option": "A", "text": "Topic"},
                {"option": "B", "text": "Other"}], "correct_answer": "A", "explanation": "The passage says so.",
                "reference": {"page": 2}, "difficulty": "easy"}
    generator = Mock(flagged_questions=[{**accepted, "question": "Held question", "flags": ["unsupported"]}])
    def generate(**kwargs):
        assert not db_session.in_transaction()
        assert kwargs["parsed_doc"].full_text == "Second source passage"
        return [accepted]
    generator.generate_questions.side_effect = generate
    factory = Mock(return_value=generator)
    monkeypatch.setattr(api, "QuestionGenerator", factory)
    return canvas, second.id, generator, factory


def test_save_reuse_more_get_and_second_source(client, db_session, setup_node, monkeypatch):
    canvas, second_id, generator, factory = setup_node
    url = f"/api/canvas/{canvas.id}/nodes/n/questions"
    invalidate = Mock()
    monkeypatch.setattr(api, "invalidate_stats_cache", invalidate)
    empty = client.get(url).json()
    assert empty == {"node_id": "n", "deck_id": None, "notebook_id": canvas.document.notebook_id,
                     "questions": [], "held_back": 0, "generated": False}
    factory.assert_not_called()
    response = client.post(url)
    assert response.status_code == 200
    data = response.json()
    assert data["generated"] is True
    assert data["held_back"] == 1
    assert len(data["questions"]) == 1
    question = db_session.query(Question).one()
    assert data["questions"][0] == {"id": question.id, "question": question.question_text,
        "options": [{"option": "A", "text": "Topic"}, {"option": "B", "text": "Other"}],
        "correct_answer": "A", "explanation": "The passage says so."}
    assert question.document_id == second_id
    assert question.source_reference == {"page": 2, "canvas_id": canvas.id, "node_id": "n"}
    deck = db_session.query(Deck).one()
    assert deck.canvas_id == canvas.id
    assert deck.notebook_id == data["notebook_id"]
    assert deck.source_ids == canvas.source_ids
    assert deck.name == "Canvas: Connections"
    assert deck.kind == "quiz"
    flagged = db_session.query(FlaggedQuestion).one()
    assert flagged.document_id == second_id
    assert flagged.deck_id == deck.id
    assert flagged.job_id == f"canvas-node-{canvas.id}-n"
    assert flagged.reasons == ["unsupported"]
    assert "flags" not in flagged.payload
    assert flagged.payload["reference"] == question.source_reference
    assert client.post(url).json() == {**data, "generated": False}
    assert client.get(url).json() == {**data, "generated": False}
    generator.generate_questions.assert_called_once()
    extra = client.post(url + "?more=true").json()
    assert extra["deck_id"] == deck.id
    assert len(extra["questions"]) == 2
    assert extra["held_back"] == 2
    assert generator.generate_questions.call_count == 2
    assert db_session.query(Deck).count() == 1
    assert [link.order for link in db_session.query(DeckQuestion).order_by(DeckQuestion.order)] == [0, 1]
    assert invalidate.call_count == 2
    flagged.status = "accepted"
    db_session.commit()
    assert client.get(url).json()["held_back"] == 1
    other = client.get(url.replace('/n/', '/other/')).json()
    assert other["questions"] == []
    assert other["held_back"] == 0


@pytest.mark.parametrize("count", [0, 11])
def test_count_bounds(client, setup_node, count):
    canvas, _, _, factory = setup_node
    assert client.post(f"/api/canvas/{canvas.id}/nodes/n/questions?count={count}").status_code == 422
    factory.assert_not_called()


def test_race_loads_winning_deck(db_session, setup_node, monkeypatch):
    canvas, _, _, _ = setup_node
    winning = Deck(canvas_id=canvas.id, name="Winner", notebook_id=canvas.document.notebook_id, kind="quiz")
    db_session.add(winning)
    db_session.commit()
    winning_id, canvas_id = winning.id, canvas.id
    real_query = db_session.query
    first_query = Mock()
    first_query.filter_by.return_value.first.return_value = None
    calls = 0
    def query(*args):
        nonlocal calls
        calls += 1
        return first_query if calls == 1 else real_query(*args)
    monkeypatch.setattr(db_session, "query", query)
    deck = api._canvas_deck(db_session, canvas_id, None, [], "Loser")
    assert deck.id == winning_id
    assert deck.name == "Winner"
    assert real_query(Deck).count() == 1


@pytest.mark.parametrize("source_index", [0, 1])
def test_source_delete_keeps_canvas_deck(client, db_session, setup_node, source_index):
    canvas, _, _, _ = setup_node
    canvas_id, source_id = canvas.id, canvas.source_ids[source_index]
    result = client.post(f"/api/canvas/{canvas_id}/nodes/n/questions").json()
    question_id = result["questions"][0]["id"]
    assert client.delete(f"/api/documents/{source_id}").status_code == 200
    db_session.expire_all()
    assert db_session.get(Canvas, canvas_id) is None
    deck = db_session.get(Deck, result["deck_id"])
    assert deck.canvas_id is None
    assert [q.id for q in deck.questions] == [question_id]
    assert db_session.query(FlaggedQuestion).count() == 1
    if source_index == 1:
        assert db_session.get(Question, question_id).document_id is None
        assert db_session.query(FlaggedQuestion).one().document_id is None
