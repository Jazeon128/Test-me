import pytest

from app.models.deck import Deck, DeckQuestion
from app.models.notebook import Notebook
from app.models.question import Question
from app.utils.cache import stats_cache


@pytest.fixture(autouse=True)
def clear_cache():
    stats_cache.invalidate_all()
    yield
    stats_cache.invalidate_all()


@pytest.fixture
def notebook_deck(db_session):
    notebook = Notebook(name="Science")
    db_session.add(notebook)
    db_session.flush()
    deck = Deck(name="Cards", notebook_id=notebook.id)
    question = Question(question_text="Existing card")
    db_session.add_all([deck, question])
    db_session.flush()
    db_session.add(DeckQuestion(deck_id=deck.id, question_id=question.id, order=0))
    db_session.commit()
    return deck


def total(client):
    response = client.get("/api/progress/stats/by-notebook")
    assert response.status_code == 200
    return response.json()[0]["total_questions"]


def test_adding_question_refreshes_notebook_total(client, notebook_deck):
    assert total(client) == 1
    response = client.post("/api/questions/", json={
        "question_text": "New card", "deck_id": notebook_deck.id,
        "options": [{"text": "Yes", "is_correct": True},
                    {"text": "No", "is_correct": False}],
    })
    assert response.status_code == 200
    assert total(client) == 2


def test_deleting_deck_refreshes_notebook_total(client, notebook_deck):
    assert total(client) == 1
    response = client.delete(f"/api/decks/{notebook_deck.id}")
    assert response.status_code == 200
    assert total(client) == 0
