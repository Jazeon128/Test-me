from app.models.deck import Deck
from app.models.notebook import Notebook
from app.models.question import Question


def test_review_session_notebook_membership(client, db_session, sample_question, sample_document):
    alpha = Notebook(name="Alpha")
    zulu = Notebook(name="Zulu")
    db_session.add_all([alpha, zulu])
    db_session.flush()
    sample_document.notebook_id = zulu.id
    single = Question(document_id=sample_document.id, question_text="Single", difficulty="easy")
    none = Question(question_text="Orphan", difficulty="easy")
    deck = Deck(name="Shared", notebook_id=alpha.id)
    deck.questions = [sample_question]
    duplicate = Deck(name="Same notebook", notebook_id=zulu.id)
    duplicate.questions = [sample_question]
    db_session.add_all([single, none, deck, duplicate])
    db_session.commit()

    response = client.post("/api/progress/review-session", json={"num_questions": 50})
    assert response.status_code == 200
    items = {item["id"]: item for item in response.json()["questions"]}
    assert items[single.id]["notebooks"] == [{"id": zulu.id, "name": "Zulu"}]
    assert items[sample_question.id]["notebooks"] == [
        {"id": alpha.id, "name": "Alpha"}, {"id": zulu.id, "name": "Zulu"},
    ]
    assert items[none.id]["notebooks"] == []
