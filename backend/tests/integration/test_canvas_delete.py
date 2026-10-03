from unittest.mock import Mock

from app.api import canvas as api
from app.models.canvas import Canvas, CanvasRoutingLog
from app.models.deck import Deck
from app.models.flagged_question import FlaggedQuestion


def test_delete_preserves_deck_and_questions(client, db_session, sample_question, monkeypatch):
    document_id = sample_question.document_id
    canvas = Canvas(document_id=document_id, request_text="Draw", template="flowchart",
                    payload_json={}, sources_json=[])
    other = Canvas(document_id=document_id, request_text="Other", template="flowchart",
                   payload_json={}, sources_json=[])
    db_session.add_all([canvas, other])
    db_session.flush()
    deck = Deck(name="Canvas quiz", canvas_id=canvas.id)
    deck.questions = [sample_question]
    db_session.add(deck)
    db_session.flush()
    held = FlaggedQuestion(deck_id=deck.id, document_id=document_id,
                           payload={"question": "Held"}, reasons=["unsupported"])
    logs = [CanvasRoutingLog(canvas_id=canvas.id, request_text="Draw"),
            CanvasRoutingLog(canvas_id=canvas.id, request_text="Retry"),
            CanvasRoutingLog(canvas_id=other.id, request_text="Other")]
    db_session.add_all([held, *logs])
    db_session.commit()
    canvas_id, deck_id, held_id = canvas.id, deck.id, held.id
    log_ids = [log.id for log in logs]
    question_id = sample_question.id
    option_ids = [option.id for option in sample_question.options]
    invalidate = Mock()
    monkeypatch.setattr(api, "invalidate_stats_cache", invalidate)

    response = client.delete(f"/api/canvas/{canvas_id}")

    assert response.status_code == 200
    assert response.json() == {"message": "Canvas deleted"}
    db_session.expire_all()
    assert db_session.get(Canvas, canvas_id) is None
    retained = db_session.get(Deck, deck_id)
    assert retained.canvas_id is None
    assert [question.id for question in retained.questions] == [question_id]
    assert [option.id for option in retained.questions[0].options] == option_ids
    assert db_session.get(FlaggedQuestion, held_id).deck_id == deck_id
    assert db_session.get(FlaggedQuestion, held_id).status == "pending"
    assert db_session.get(FlaggedQuestion, held_id).payload == {"question": "Held"}
    assert db_session.get(FlaggedQuestion, held_id).reasons == ["unsupported"]
    assert db_session.get(CanvasRoutingLog, log_ids[0]) is None
    assert db_session.get(CanvasRoutingLog, log_ids[1]) is None
    assert db_session.get(CanvasRoutingLog, log_ids[2]).canvas_id == other.id
    invalidate.assert_called_once_with()
    assert client.get(f"/api/canvas/{canvas_id}").status_code == 404


def test_delete_missing_canvas(client):
    response = client.delete("/api/canvas/99999")
    assert response.status_code == 404
    assert response.json()["error"]["message"] == "Canvas not found"
