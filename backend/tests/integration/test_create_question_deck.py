import pytest
from sqlalchemy.orm import Session

from app.models.deck import Deck, DeckQuestion
from app.models.question import Question, QuestionOption


def payload(deck_id):
    return {
        "question_text": "A manually added card?",
        "options": [{"text": "Yes", "is_correct": True}, {"text": "No", "is_correct": False}],
        "deck_id": deck_id,
    }


@pytest.mark.parametrize("existing_order", [None, 7])
def test_created_question_joins_deck(client, db_session, sample_question, existing_order):
    deck = Deck(name="Manual cards")
    if existing_order is not None:
        deck.deck_questions.append(DeckQuestion(question_id=sample_question.id, order=existing_order))
    db_session.add(deck)
    db_session.commit()
    deck_id = deck.id
    response = client.post("/api/questions/", json=payload(deck_id))
    assert response.status_code == 200
    question_id = response.json()["id"]
    details = client.get(f"/api/decks/{deck_id}")
    assert details.status_code == 200
    assert details.json()["questions"][-1]["id"] == question_id
    with Session(db_session.get_bind()) as fresh:
        link = fresh.get(DeckQuestion, (deck_id, question_id))
        assert link is not None
        assert link.order == (0 if existing_order is None else existing_order + 1)


@pytest.mark.parametrize("deck_id", [0, 999999])
def test_unknown_deck_writes_nothing(client, db_session, deck_id):
    response = client.post("/api/questions/", json=payload(deck_id))
    assert response.status_code == 404
    assert response.json()["error"]["message"] == "Deck not found"
    assert response.json()["error"]["code"] == "NOT_FOUND"
    with Session(db_session.get_bind()) as fresh:
        assert fresh.query(Question).count() == 0
        assert fresh.query(QuestionOption).count() == 0
        assert fresh.query(DeckQuestion).count() == 0
