"""CSV flashcards use their back text when grading written practice."""

from app.api import progress, questions
from app.models.deck import Deck
from app.models.user_progress import UserProgress


def test_imported_flashcard_written_answer(client, db_session, monkeypatch):
    response = client.post(
        "/api/decks/import/csv",
        files={
            "file": ("cards.csv", b"What is the capital of France?,Paris\n", "text/csv")
        },
    )
    assert response.status_code == 200
    assert response.json()["num_questions"] == 1
    deck = db_session.get(Deck, response.json()["id"])
    question, = deck.questions
    captured = {}

    def grade(question_text, expected, answer, api_key):
        captured["expected"] = expected
        captured["answer"] = answer
        return {"quality": 5, "passed": True, "expected_answer": expected}

    monkeypatch.setattr(progress, "require_typesafe_key", lambda db: "test-key")
    monkeypatch.setattr(progress, "grade_to_response", grade)
    response = client.post("/api/progress/submit", json={
        "question_id": question.id, "written_answer": "Paris", "time_taken_seconds": 5,
    })
    assert response.status_code == 200
    assert captured == {"expected": "Paris", "answer": "Paris"}
    assert response.json()["correct"] is True
    row = db_session.query(UserProgress).filter_by(question_id=question.id).one()
    assert row.times_correct == 1
    assert questions.expected_answer(question) == "Paris"
    assert questions.key_points(question) == ["Paris"]
    assert len(question.options) == 1
    assert question.options[0].option_text == "Flip to see answer"
    assert question.options[0].is_correct is True


def test_normal_four_option_question_is_unaffected(sample_question):
    assert len(sample_question.options) == 4
    assert questions.expected_answer(sample_question) == "A programming language"
    assert questions.key_points(sample_question) == [
        "A programming language", "Python is a high-level programming language.",
    ]
